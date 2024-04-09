import { getConnection } from "../constants/db.connection.js";
import { getCurrentFinancialYearId } from "../queries/financialYear.js";
import { STOREID, COMPCODE, COMPNAME, PROJECTID, TCODE, PRO_TTYPE, LOCID, POTYPE, TRANSTYPE, REC_STOCK_TYPE, COMPSHORTCODE, STORES, ORDERTRANSTYPE, KNITTING_PROCESS_RECEIPT_PTRANSACTION, STOCKTTYPE } from "../constants/defaultQueryValues.js"
import { getNextKnittingProReceiptNo } from "../queries/sequences.js";
import { getSupplierName } from "../queries/supplier.js";
import moment from "moment";
import { getRemovedItems, substract } from "../Helpers/helper.js";
import { deleteYarnStock } from "../queries/stockHelper.js";
export async function getDocId(req, res) {
    const connection = await getConnection(res)
    const ydTKno = await getNextKnittingProReceiptNo(connection);
    connection.close()
    return res.json({ statusCode: 0, docId: ydTKno })
}
const date = new Date()
export async function create(req, res) {
    const connection = await getConnection(res)
    const { supplierId: gtCompMastId, remarks: REMARKS, vehicleNo: VEHICLENO, supplierDcDate: DCDATE, supplierDcNo: SUPPDCNO, deliveryDetails, consDetails, ydTKno, docNo, userName } = req.body;
    console.log(req.body, 'docNo');
    try {
        if (!gtCompMastId) {
            return res.json({ statusCode: 1, message: 'Required Fields: supplierId, deliveryDetails' });
        }

        if (deliveryDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Delivery Details Cannot be Empty' });
        }
        const YDTKDATE = moment(new Date()).format("DD-MM-YYYY");
        const FINYEAR = await getCurrentFinancialYearId(connection);
        const YDTKNO = await getNextKnittingProReceiptNo(connection);
        const SUPPLIER = await getSupplierName(connection, gtCompMastId);
        const TOTALQTY = deliveryDetails.reduce((a, c) => a + parseFloat(c.jobQty), 0);
        const sqlData = `
        select BUYERCODE, PROCESSNAME,PRE,gtKnitJoId,orderNo,JOBTYPE  from gtknitjo where gtknitjo.gtknitjoid = :docNo
      `;
        const jobDetails = await connection.execute(sqlData, { docNo: docNo });
        console.log(ydTKno, 'job');
        if (!jobDetails) return res.json({ statusCode: 1, message: 'Job Not Found' });
        const [BUYERCODE, PROCESSNAME, PRE, GTYARNPROJOID, ORDERNO, JOBTYPE] = jobDetails.rows[0];
        const totalIssQty = deliveryDetails.reduce((a, c) => a + parseFloat(c.recQty), 0);
        const nonGridSql = `
        INSERT INTO GTFABRECTOKNIT (GTFABRECTOKNITID, STORES, FINYEAR, COMPCODE, TCODE, TTYPE, PTRANSACTION, COMPNAME,REMARKS, VEHICLENO, LOCID, SUPPLIER, suppDcDate,
            suppDcNo, YDTKDATE, YDTKNO,PROJECTID,TOTALQTY,
                     BUYERCODE,PROCESSNAME, JOBNO, ORDERNO,TRANSTYPE,PRE,ENTRYTYPE, USERID, created_by,CREATED_ON)
        VALUES ( supplierseq.nextVal, '${STOREID}', '${FINYEAR}' , '${COMPCODE}' , '${TCODE}' , '${PRO_TTYPE}' , '${KNITTING_PROCESS_RECEIPT_PTRANSACTION}' , '${COMPNAME}' ,'${REMARKS}' ,
             '${VEHICLENO}' , '${LOCID}' , '${SUPPLIER}', TO_DATE('${DCDATE}', 'DD/MM/YY'), '${SUPPDCNO}', TO_DATE('${YDTKDATE}','DD/MM/YY'), '${YDTKNO}',
             '${PROJECTID}','${totalIssQty}',
             '${BUYERCODE}','${PROCESSNAME}','${GTYARNPROJOID}','${ORDERNO}', '${ORDERTRANSTYPE}', '${PRE}','SP', '${userName}','${userName}',    TO_TIMESTAMP('${moment(date).format("YYYY-MM-DD HH:mm:ss")}', 'YYYY-MM-DD HH24:MI:SS.FF'))
        `;
        console.log(nonGridSql, 'nonGridSql');
        const nonGridResult = await connection.execute(nonGridSql)
        const lastRowData = await connection.execute(`
        select GTFABRECTOKNITID from GTFABRECTOKNIT where rowid = '${nonGridResult.lastRowid}'
        `)
        const GTFABRECTOKNITID = lastRowData.rows[0][0]
        await connection.execute(`
        UPDATE GTFABRECTOKNIT SET versionid = ${GTFABRECTOKNITID} where rowid = '${nonGridResult.lastRowid}' 
        `)
        console.log(GTFABRECTOKNITID, 'GTFABRECTOKNITID');
        await (async function createGridDetails() {
            const promises = deliveryDetails.map(async (deliveryItem) => {
                console.log(deliveryItem.gtKnitJoDetid, 'id');
                const gridSqlDet = (`
                SELECT 
                det.aliasname,
                det.color,
                det.buyercode1,
                det.uom,
                det.processname1,
                det.joamt,
                det.tax,
                det.orderno1,
                det.jobQty,
                po.gtKnitJoId,
                po.docdate,
                det.TOTALRECQTY,
                det.jobPrice,
                gtfabricmast.fabric,
                gtunitmast.unitname,
                gtcolormast.colorname,
                gtbuyermast.buyercode,
                gtprocessmast.PROCESSNAME,
                gtFinancialyear.finyr,
                det.issQty,
                det.fabrictype,
                det.design
            FROM 
                gtknitjodet det
            JOIN 
                gtKnitJo po ON det.gtKnitJoId = po.gtKnitJoId
                left join gtfabricMast on gtfabricMast.gtfabricMastid = det.aliasname
                left join gtunitmast on gtunitmast.GTUNITMASTID = det.uom
                left join gtcolormast on gtcolormast.GTCOLORMASTID = det.COLOR
                left join gtbuyermast on gtbuyermast.buyercode = det.buyercode1
                left join gtprocessmast on gtprocessmast.gtprocessmastid = det.PROCESSNAME1  
                left join gtFinancialYear on gtFinancialYear.GTFINANCIALYEARID = po.finyear
            WHERE 
                det.gtknitjodetid= ${deliveryItem.gtKnitJoDetid}
            `);
                console.log(gridSqlDet, 'det 94');

                let gtYarnProDetResult = await connection.execute(gridSqlDet);

                const [yarnname,
                    color,
                    buyercode,
                    uom,
                    processname,
                    proamount,
                    tax,
                    orderNo,
                    jobQty,
                    gtKnitJoId,
                    jobDate,
                    TOTALRECQTY,
                    jobPrice,
                    fabAliasName, unitName, colorName, buyerCode, processName, finYearCode, issQty, fabricType, design] = gtYarnProDetResult.rows[0];

                console.log(gtYarnProDetResult.rows[0], 'res');
                const taxRate = jobPrice + (jobPrice / 100 * tax)
                const balQty = parseFloat(jobQty) - parseFloat(TOTALRECQTY ? TOTALRECQTY : 0)
                const totalRecQty = parseFloat(deliveryItem.recQty);
                let grnQty = totalRecQty;
                let excessQty = 0;
                if (grnQty > balQty) {
                    grnQty = balQty
                    excessQty = totalRecQty - balQty
                }

                const convertedPoDate = moment(jobDate).format("DD-MM-YYYY")
                const gridSql = `
                INSERT INTO gtFabRecToKnitDet (
                    gtFabRecToKnitDetid,
                    GTFABRECTOKNITID,
                    Fabric,
                    COLOR,
                    UOM,
                    TAXRATE1,
                    gtKnitJodetid,
                    JOBQTY,
                    rolls,
                    RECQTY,
                    EXCESSQTY,
                    LOTNO1,
                    jobPrice,
                    totalRecQty,
                    issQty,
                    rkdia,
                    rll,
                    rgsm,
                    rgg,
                    kdia,
                    gg,
                    ll,
                    gsm,
                    fabtype,
                    design
                )
                VALUES(supplierseq.nextVal, '${GTFABRECTOKNITID}', '${yarnname}', '${color}',
                    '${uom}', '${taxRate}', '${deliveryItem.gtKnitJoDetid}', '${jobQty}', 
                    '${deliveryItem.rolls}', '${deliveryItem.recQty}', '${excessQty}',
                    '${deliveryItem.lotNo}', '${jobPrice}', '${totalRecQty}', '${deliveryItem.issQty}','${deliveryItem.rkdia}' ,'${deliveryItem.rll}','${deliveryItem.rgsm}','${deliveryItem.rgg}','${deliveryItem.diaId}','${deliveryItem.ggId}','${deliveryItem.llId}','${deliveryItem.gsmId}','${fabricType}', '${design}')
            `;
                console.log(gridSql, 'create');
                await connection.execute(gridSql)


                const stockSql = `INSERT INTO gtfabricstockmast (gtfabricstockmastid, TAXRMRATE, RMRATE, PROJECTID, IS_CANCELLED, 
                    STOCKQTY, EXCESSQTY,COMPNAME, LOTNO, 
                    FINYEAR,COMPCODE, DOCID, DOCDATE, PLUSORMINUS, TRANSTYPE, ORDERNO, 
                    fabric, COLOR, UOM, QTY, 
                    RATE, TAXRATE,AMOUNT,TAXAMT,
                    LOCID,STOREID,PROCESSNAME,TOTALRATE,TAXTOTALRATE,ORDERTRANSTYPE, STOCKTYPE,BUYERCODE,fabricType,design) 
                    VALUES(supplierseq.nextVal, 0, 0, '${PROJECTID}', 'F', 
                    '${totalRecQty}', '${excessQty}', '${COMPNAME}', '${deliveryItem.lotNo}', 
                    '${finYearCode}', '${COMPSHORTCODE}', '${YDTKNO}', TO_DATE('${YDTKDATE}', 'DD-MM-YYYY'), 'P', '${KNITTING_PROCESS_RECEIPT_PTRANSACTION}','${orderNo}', 
                    '${fabAliasName}', '${colorName}', '${unitName}', '${totalRecQty}', ${jobPrice}, '${taxRate}' , '${jobPrice * totalRecQty}',
                    '${totalRecQty * grnQty}', 
                    '${LOCID}', '${STORES}','${processName}', '${jobPrice}', '${taxRate}', '${TRANSTYPE}', '${REC_STOCK_TYPE}','${buyerCode}','${fabricType}','${design}')`;
                console.log(stockSql, 'stockSql');
                await connection.execute(stockSql);
                const accumulatedGrnQty = parseFloat(TOTALRECQTY ? TOTALRECQTY : 0) + parseFloat(totalRecQty);
                const updatePoDetSql = `
                UPDATE gtknitjodet 
                SET totalRecQty = ${accumulatedGrnQty},
                    excessQty = ${excessQty},
                recQty = ${substract(accumulatedGrnQty, excessQty)}
                WHERE   gtknitjodet.gtknitjodetid= ${deliveryItem.gtKnitJoDetid
                    }`
                console.log(updatePoDetSql, 'updatePoDetSql');
                await connection.execute(updatePoDetSql)

            })

            return Promise.all(promises)
        })()
        await (async function createConsGridDetails() {
            console.log(consDetails, 'consDetails');
            const consPromises = consDetails.map(async (consItems) => {

                let gtYarnProDetResult1 = await connection.execute(`
                SELECT 
                det.aliasnameyarn,
                det.yarncolor,
                det.uom1,
                det.yarnContents,
                det.prevProcess,
                det.knitissQty,
                det.getrate,
                det.taxrate,
                det.gtyarndeltoknitid,
                det.yarntype,
                det.counts,
                det.knitIssBag
                FROM 
                gtyarndeltoknitstk det   
                     WHERE 
                det.gtyarndeltoknitid
                = ${consItems.yarnDelToknitId}
                `)
                const [yarnname, color, uom, YarnContents, prevProcess, knitissQty, getrate, taxRate, gtyarndeltoknitid, yarnType, counts, knitIssBag, issid1] = gtYarnProDetResult1.rows[0]
                console.log(gtYarnProDetResult1.rows[0], 'cons');

                const gridSql1 = `
                INSERT INTO gtfabrectoknitstk (
                    gtfabrectoknitstkid,
                    GTFABRECTOKNITID,
                    ALIASNAMEYArn,
                    YARNCOLOR,
                    UOM1,
                    TAXRATE,
                    knitissQty,
                    lossQty,
                    RecQty1,
                    LOTNo,
                    yarncontents,
                    yarntype,
                    counts,
                    prevProcess,
                    stockType,
                    knitIssBag,
                    issNo1
                                    )
                VALUES(supplierseq.nextVal,
                     '${GTFABRECTOKNITID}',
                      '${yarnname}', 
                      '${color}',
                    '${uom}',
                     '${taxRate}',
                     '${knitissQty}',
                    '${consItems.lossQty}',
                    '${consItems.issRecQty}',
                    '${consItems.lotNo}',
                    '${YarnContents}',
                    '${yarnType}',
                    '${counts}',
                    '${prevProcess}',
                    '${STOCKTTYPE}',
                    '${knitIssBag}',
                    '${gtyarndeltoknitid}'
                 )
            `
                console.log(gridSql1, 'const gridSql1');
                await connection.execute(gridSql1)
            })
            return Promise.all(consPromises)
        })()
        await getNextKnittingProReceiptNo(connection)
        connection.commit()
        return res.json({ statusCode: 0, data: GTFABRECTOKNITID })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ error: err })
    } finally {
        await connection.close()
    }

}

export async function get(req, res) {
    const connection = await getConnection(res)
    let result;
    try {
        const { gtCompMastId, itemWiseFilter, IS_REC } = req.query
        console.log(req.query, 'data');
        let isRec = IS_REC ? IS_REC.toString() : ""
        if (itemWiseFilter) {
            const sql = `
SELECT 
gtYarnMaster.yarnName,
gtColorMast.colorName,
gtFabRecToKnitDet.poNo,
gtFabRecToKnitDet.orderNo,
gtFabRecToKnitDet.totalgrnQty,
gtFabRecToKnitDet.poPrice,
gtFabRecToKnitDet.balQty,
gtFabRecToKnitDet.jobQty,
gtFabRecToKnitDet.grnBags,
gtFabRecToKnitDet.lotNo,
gtFabRecToKnitDet.agrnQty,
gtFabRecToKnitDet.gtFabRecToKnitid,
gtYarnPoDet.gtYarn  gtknitjodetid,
del.docid,
poBags,
del.delTO,
gtFabRecToKnitDet.remarks, 
gtFabRecToKnitDet.vehicleno,
gtFabRecToKnitDet.ypoino,
gtFabRecToKnitDet.IS_REC
FROM
gtFabRecToKnitDet
JOIN
gtYarnMaster ON gtYarnMaster.gtYarnMasterId = gtFabRecToKnitDet.YARNNAME
JOIN
gtColorMast ON gtColorMast.gtColorMastId = gtFabRecToKnitDet.COLORNAME
JOIN
gtYarnPoDet ON gtYarnPoDet.  gtknitjodetid
 = gtFabRecToKnitDet.  gtknitjodetid

JOIN                  
gtFabRecToKnitDet ON gtFabRecToKnitDet.gtYarnPoInwardId = gtFabRecToKnitDet.gtYarnPoInwardId
JOIN 
gtKnitJo deL ON del.gtKnitJoId = gtYarnPoDet.gtKnitJoId
JOIN 
gtCompMast supp ON supp.compName1 = DEL.DELTO 
    where  SUPP.gtCompMastId = :gtCompMastId
    ${isRec ?
                    `AND gtFabRecToKnitDet.IS_REC = ${isRec === 'true' ? 1 : 0}`
                    :
                    ""}
   `
            result = await connection.execute(sql, { gtCompMastId })
            const resp = result.rows.map(del => ({
                yarn: del[0], color: del[1], poId: del[2], poNo: del[13], orderNo: del[3],
                delQty: del[4], poPrice: del[5], balQty: del[6], jobQty: del[7],
                delBags: del[8], lotNo: del[9], aDelQty: del[10], gtFabRecToKnitid: del[11], gtknitjodetid
                    : del[12], poBags: del[14], delTO: del[15], remarks: del[16], vehNo: del[17],
                ypoino: del[18], isReceived: del[19]
            }))

            return res.json({ statusCode: 0, data: resp })
        } else {
            result = await connection.execute(`
            select 
            gtFabRecToKnit.remarks,
            gtFabRecToKnit.supplier,
            gtFabRecToKnit.TOTALbags,
            gtFabRecToKnit.SUPPDCDATE,
            gtFabRecToKnit.TOTALQTY,
            gtFabRecToKnit.TOTALQTY,
            gtFabRecToKnit.JOBDATE,
            gtFabRecToKnit.YDTKNO,
            gtFabRecToKnit.jobno,
            gtFabRecToKnit.VEHICLENO,
            gtFabRecToKnit.gtFabRecToKnitid,
            gtFabRecToKnit.SUPPDCNO
                       from 
            gtFabRecToKnit
                 JOIN   gtCompMast ON gtCompMast.compName1 =  gtFabRecToKnit.supplier
            WHERE 
                 gtCompMast.gtCompMastId = :gtCompMastId
 
    `, { gtCompMastId })
            const resp = result.rows.map(del => ({
                remarks: del[0], supplier: del[1], totalBag: del[2], supplierDcDate: del[3], issQty: del[4], totalQty: del[5],
                jobDate: del[6], recNo: del[7], jobNo: del[8], vehNo: del[9], gtyarnproreceiptId: del[10], supplierDcNo: del[11]
            }))

            return res.json({ statusCode: 0, data: resp })
        }
    }
    catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}

export async function updateIsRec(req, res) {
    const connection = await getConnection(res)
    try {
        const { gtFabRecToKnitid } = req.query;
        const response = await connection.execute(`
        UPDATE gtFabRecToKnitDet a
        SET a.IS_REC = 1
        WHERE a.gtFabRecToKnitid = :gtFabRecToKnitid
                        `, { gtFabRecToKnitid });

        connection.commit();

        if (response.rowsAffected === 1) {
            return res.json({ statusCode: 0, data: "Purchase Order Accepted" });
        } else {
            return res.json({ statusCode: 1, data: "ydTKno Does not Exist" });
        }
    } catch (err) {
        console.error('Error updating data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await connection.close();
    }
}
export async function getDelDetails(req, res) {
    const connection = await getConnection(res)

    try {
        const { ydTKno } = req.query
        console.log(ydTKno, 'isno');
        const result = await connection.execute(`
        SELECT
        gtyarnmaster.yarnname,
        gtColorMast.colorName,
       gtFabRecToKnitDet.jobQty,
       gtFabRecToKnitDet.issQty,
       gtFabRecToKnitDet.jobPrice,
       gtFabRecToKnitDet.excessQty,
       gtunitmast.unitName,
       gtFabRecToKnitDet.rolls,
       gtFabRecToKnitDet.gtFabRecToKnitid,
       gtFabRecToKnitDet.totalrecqty,
       gtFabRecToKnitDet. RECQTY,
       gtFabRecToKnitDet.LOTNO1,
       gtFabRecToKnitDet.gtknitjodetid,
       gtFabRecToKnit.jobno,
       gtFabRecToKnitDet.rll,
       gtFabRecToKnitDet.rgg,
       gtFabRecToKnitDet.rgsm,
       gtFabRecToKnitDet.rkdia,
       gtfabricMast.fabric
           FROM
       gtFabRecToKnitDet
   JOIN
       gtColorMast ON gtColorMast.gtColorMastId = gtFabRecToKnitDet.COLOR
   JOIN
       gtFabRecToKnit ON gtFabRecToKnit.gtFabRecToKnitid = gtFabRecToKnitDet.gtFabRecToKnitid
   left join 
       gtyarnmaster on gtyarnmaster.gtyarnmasterid = gtFabRecToKnitDet.aliasname
   left join 
       gtfabricmast on gtfabricmast.gtfabricmastid = gtFabRecToKnitDet.fabric
          left join gtunitmast on gtunitmast.gtunitmastid = gtFabRecToKnitDet.uom
   WHERE
   gtFabRecToKnit.gtFabRecToKnitid = : ydTKno`, { ydTKno })
        const resp = result.rows.map(del => ({
            yarn: del[0], color: del[1], jobQty: del[2], issQty: del[3], jobPrice: del[4],
            excessQty: del[5], uom: del[6], rolls: del[7], gtFabRecToKnitid: del[8],
            totalrecQty: del[9], recQty: del[10], lotNo: del[11], gtknitjodetid
                : del[12], jobId: del[13], rll: del[14], rgg: del[15], rgsm: del[16], rkdia: del[17], fabric: del[18]
        }))
        const result1 = await connection.execute(`
        select
        gtFabRecToKnit.remarks,
        gtFabRecToKnit.suppdcno,
        gtFabRecToKnit.ydtkDate,
        gtFabRecToKnit.ydtkno,
        gtFabRecToKnit.vehicleno,
        gtFabRecToKnit.supplier,
        gtcompmast.compname,
        gtFabRecToKnit.GTFABRECTOKNITID,
        gtKnitJo.docid,
        gtprocessMast.PROCESSNAME
        from 
        gtFabRecToKnit
        left join gtcompmast on gtcompmast.GTCOMPMASTID =  gtFabRecToKnit.compcode
        left join gtKnitJo on gtKnitJo.gtKnitJoId = gtFabRecToKnit.jobNo
        left join gtprocessmast on gtprocessmast.GTPROCESSMASTID = gtFabRecToKnit.PROCESSNAME   
   WHERE
        gtFabRecToKnit.gtFabRecToKnitid = : ydTKno
        `, { ydTKno })

        const po = result1.rows[0]
        const delNonGridDetails = {
            remarks: po[0], supplierDcNo: po[1], dcDate: po[2], recNo: po[3],
            vehicleNo: po[4], supplier: po[5], comName: po[6], receiptId: po[7], ydTKno: po[8], processName: po[9]
        }
        console.log(delNonGridDetails, 'delNonGridDetails');
        const ConsumptionDet = await connection.execute(`
        select
        gtfabrectoknitstk.gtfabrectoknitstkid,
        gtfabrectoknitstk.gtFabRecToKnitid,
        gtyarnmaster.yarn,
        gtcolormast.colorName,
        gtunitMast.unitName,
        gtfabrectoknitstk.TAXRATE,
        gtfabrectoknitstk.knitissQty,
        gtfabrectoknitstk.lossQty,
        gtfabrectoknitstk.RecQty1,
        gtfabrectoknitstk.LOTNO,
        gtYarnDelToKnit.YDTKNO ,
         gtprocessmast.PROCESSNAME
         from 
        gtfabrectoknitstk 
 LEFT JOIN 
        gtcolormast on gtcolormast.gtcolormastid = gtfabrectoknitstk.YARNCOLOR       
 left join 
        gtyarnmaster on gtyarnmaster.gtyarnmasterid = gtfabrectoknitstk.aliasNameYarn
 left join 
        gtunitMast on gtunitMast.gtunitMastid = gtfabrectoknitstk.uom1 
 left join gtFabRecToKnit on gtfabrectoknitstk.gtFabRecToKnitid = gtFabRecToKnit.GTFABRECTOKNITID   
 left join gtYarnDelToKnit on gtYarnDelToKnit.gtYarnDelToKnitid = gtfabrectoknitstk.issno1
 left join gtprocessmast on  gtprocessmast. gtprocessmastid = gtfabrectoknitstk.prevProcess
   where
 gtFabRecToKnit.gtFabRecToKnitid = : ydTKno
 `, { ydTKno })
        const stock = ConsumptionDet.rows.map(stc => ({
            stockId: stc[0], receiptId: stc[1], yarnType: stc[2], color: stc[3], uom: stc[4], tax: stc[5], issQty: stc[6], lossQty: stc[7], issRecQty: stc[8], lotNo: stc[9], issueno: stc[10], processName: stc[11]
        }))
        console.log(stock, 'stock');
        return res.json({ statusCode: 0, data: { ...delNonGridDetails, deliveryDetails: resp, consDetails: stock } })

    } catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await connection.close()
    }

}
export async function upDate(req, res) {

    const { vehicleNo, remarks, supplierDcDate, supplierDcNo, delNo, deliveryDetails, consDetails, recNo } = req.body;
    const connection = await getConnection(res);
    try {
        if (!delNo || !deliveryDetails || !consDetails) {
            return res.json({ statusCode: 1, message: 'Required Fields: ydTKno , deliveryDetails' });
        }
        if (deliveryDetails && consDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Delivery Details Cannot be Empty' });
        }

        const TOTALQTY = deliveryDetails.reduce((a, c) => a + parseFloat(c.delQty), 0);

        const nonGridSql = `
            UPDATE GTFABRECTOKNIT
            SET vehicleNo = '${vehicleNo}',
                remarks = '${remarks}',
                SUPPDCDATE = TO_DATE('${supplierDcDate}', 'DD-MM-YYYY'),
                SUPPDCNO = '${supplierDcNo}'
                          WHERE GTFABRECTOKNITID= '${delNo}'
        `;

        console.log(nonGridSql, 'nonsql');
        const nonGridResult = await connection.execute(nonGridSql);
        const lastRowData = await connection.execute(`
        select GTFABRECTOKNITID,ydtkdate,YDTKNO from GTFABRECTOKNIT where rowid = '${nonGridResult.lastRowid}'
        `)
        console.log(lastRowData, 'lastRowData');
        const [GTFABRECTOKNITID, YDTKDATE, YDTKNO] = lastRowData.rows[0]

        let oldDeliveryDetailsItems = await connection.execute(`SELECT gtFabRecToKnitDetid from GTFABRECTOKNITdet
        WHERE GTFABRECTOKNITID = ${GTFABRECTOKNITID}`)
        oldDeliveryDetailsItems = oldDeliveryDetailsItems.rows.map(item => item[0])

        const newUpdateDeliveryItemsIds = deliveryDetails.filter(item => item?.gtFabRecToKnitid).map(item => item?.gtFabRecToKnitid)

        const removedItems = getRemovedItems(oldDeliveryDetailsItems, newUpdateDeliveryItemsIds);

        if (removedItems.length > 0) {
            await connection.execute(`DELETE FROM gtFabRecToKnitDet WHERE gtFabRecToKnitid IN (${removedItems}) `)
        }
        await deleteYarnStock(connection, delNo)
        await (async function updateGridDetails() {
            const promises = deliveryDetails.map(async (deliveryItem) => {
                const alreadyGrnResult = await connection.execute(`
                select COALESCE(sum(totalrecqty),0 ) 
                from gtFabRecToKnitDet 
                    where   gtknitjodetid
 = ${deliveryItem.gtknitjodetid
                    } and GTFABRECTOKNITID < ${GTFABRECTOKNITID}
                    `)
                const [TOTALRECQTY] = alreadyGrnResult.rows[0]
                const gridsql = `
                select 
                aliasname,
               det.color,
                uom,
               det.processname1,
                joamt,
                tax,
                orderno,
                jobQty,
                po.gtKnitJoId,
                po.docdate,
                gtfabricmast.fabric,
                gtunitmast.unitname,
                gtcolormast.colorname,
                gtbuyermast.buyercode,
                gtprocessmast.PROCESSNAME,
                fy.finyr,
                jobPrice
            from gtknitjodet det
            left join gtKnitJo po on det.gtKnitJoId = po.gtKnitJoId
            LEFT JOIN gtfinancialYear fy on fy.gtfinancialYearid = po.finYear
            left join gtfabricmast on gtfabricmast.gtfabricmastid = det.aliasname
          left  join gtunitmast on gtunitmast.GTUNITMASTID = det.uom
            left join gtcolormast on gtcolormast.GTCOLORMASTID = det.COLOR
            left join gtbuyermast on gtbuyermast.buyerCode = det.buyercode1
            left join gtprocessmast on gtprocessmast.gtprocessmastid = det.PROCESSNAME1          
                         where gtknitjodetid
 =${deliveryItem.gtknitjodetid
                    }
                `; console.log(gridsql, 'gridsql');
                const gtYarnPoDetResult = await connection.execute(gridsql)
                const [yarnname, color, uom, processname, proamount, tax, orderNo, jobQty, gtKnitJoId, jobDate, fabAliasName, unitName, colorName, buyerCode, proName, finYearCode, jobPrice] = gtYarnPoDetResult.rows[0]
                const taxRate = jobPrice + (jobPrice / 100 * tax)
                const balQty = parseFloat(jobQty) - parseFloat(TOTALRECQTY)
                const totalRecQty = parseFloat(deliveryItem.totalrecQty);
                console.log(deliveryItem.totalrecQty, 'recqty');
                let grnQty = totalRecQty;
                let excessQty = 0;
                if (grnQty > balQty) {
                    grnQty = balQty
                    excessQty = totalRecQty - balQty
                }
                console.log(YDTKDATE, 'YDTKDATE');
                const stockSql = `INSERT INTO gtfabricstockmast (gtfabricstockmastid, TAXRMRATE, RMRATE, PROJECTID, IS_CANCELLED, 
                    STOCKQTY, EXCESSQTY,COMPNAME, LOTNO, 
                    FINYEAR,COMPCODE, DOCID, DOCDATE, PLUSORMINUS, TRANSTYPE, ORDERNO, 
                    FABRIC, COLOR, UOM, QTY, 
                    RATE, TAXRATE,AMOUNT,TAXAMT,
                    LOCID,STOREID,PROCESSNAME,TOTALRATE,TAXTOTALRATE,ORDERTRANSTYPE, STOCKTYPE) 
                    VALUES(supplierseq.nextVal, 0, 0, '${PROJECTID}', 'F', 
                    '${totalRecQty}', '${excessQty}', '${COMPNAME}', '${deliveryItem.lotNo}', 
                    '${finYearCode}', '${COMPSHORTCODE}','${YDTKNO}',   TO_TIMESTAMP('${moment(YDTKDATE).format("YYYY-MM-DD ")}', 'YYYY-MM-DD'), 'P', '${KNITTING_PROCESS_RECEIPT_PTRANSACTION}','${orderNo}', 
                    '${fabAliasName}', '${colorName}', '${unitName}', '${totalRecQty}', '${jobPrice}', '${taxRate}' , '${jobPrice * totalRecQty}',
                    '${totalRecQty * grnQty}', 
                    '${LOCID}', '${STORES}','${proName}', '${jobPrice}', '${taxRate}', '${TRANSTYPE}', '${REC_STOCK_TYPE}')`;
                console.log(stockSql, 'stocksql');
                await connection.execute(stockSql);
                if (deliveryItem?.gtFabRecToKnitid) {
                    const gridSql = `
                                UPDATE gtfabrectoknitdet
                                SET totalRecQty = '${totalRecQty}',
                                recQty = '${deliveryItem.recQty}',
                                lotNo1 = '${deliveryItem.lotNo}' 
                                WHERE gtFabRecToKnitid = '${deliveryItem?.gtFabRecToKnitid}'
                            `;
                    console.log(gridSql, 'u grid sql');
                    await connection.execute(gridSql)
                } else {
                    const convertedPoDate = moment(jobDate).format("DD-MM-YYYY")
                    const gridSql = `
                INSERT INTO gtFabRecToKnitDet (gtFabRecToKnitid,GTFABRECTOKNITID,YARNPROCESS,BUYERCODE, YARNNAME, COLORNAME, JOBNO, 
                    UOM,AGRNQTY, TAXRATE,   gtknitjodetid, ORDERNO, GRNQTY, 
                    BALQTY, POPRICE, POQTY, GRNBAGS, TOTALGRNQTY, LOTNO, POBAGS, POTYPE, PODATE, TRANSTYPE, EXCESSQTY)
                    VALUES(supplierseq.nextVal, ${GTFABRECTOKNITID},'${processname}','${buyerCode}', '${yarnname}', '${color}', '${gtKnitJoId}', 
                    '${uom}', ${TOTALRECQTY}, ${taxRate}, '${deliveryItem.gtknitjodetid
                        }', '${orderNo}', ${grnQty}, 
                    ${balQty}, ${proamount}, ${jobQty}, ${deliveryItem.delBags}, ${totalRecQty}, '${deliveryItem.lotNo}', ${poBags}, '${POTYPE}', 
                    TO_DATE('${convertedPoDate}', 'DD-MM-YYYY'), '${TRANSTYPE}', ${excessQty}  )
                    `
                    await connection.execute(gridSql)
                    console.log(gridSql, ' gridSql 536');
                }
                const accumulatedGrnQty = parseFloat(TOTALRECQTY ? TOTALRECQTY : 0) + parseFloat(totalRecQty);
                const updatePoDetSql = `
                UPDATE GTKNITJODET 
                SET totalRecQty = ${accumulatedGrnQty},
                excessQty = ${excessQty},
                recQty = ${substract(accumulatedGrnQty, excessQty)}
                WHERE   gtknitjodetid
 = ${deliveryItem.gtknitjodetid
                    }
            `
                await connection.execute(updatePoDetSql)
            })
            return Promise.all(promises)
        })()
        connection.commit()
        return res.json({ statusCode: 0, message: "Updated Successfully" })
    } catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await connection.close();
    }
}



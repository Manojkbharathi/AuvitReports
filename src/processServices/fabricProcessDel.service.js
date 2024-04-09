import { getConnection } from "../constants/db.connection.js";
import { getCurrentFinancialYearId } from "../queries/financialYear.js";
import { STOREID, COMPCODE, COMPNAME, PROJECTID, TCODE, PRO_TTYPE, LOCID, POTYPE, TRANSTYPE, REC_STOCK_TYPE, COMPSHORTCODE, STORES, ORDERTRANSTYPE, FABRIC_PROCESS_RECEIPT_PTRANSACTION, STOCKTTYPE } from "../constants/defaultQueryValues.js"
import { getNextFabricProReceiptNo } from "../queries/sequences.js";
import { getSupplierName } from "../queries/supplier.js";
import moment from "moment";
import { getRemovedItems, substract } from "../Helpers/helper.js";
import { deleteYarnStock } from "../queries/stockHelper.js";
export async function getDocId(req, res) {
    const connection = await getConnection(res)
    const fpdNo = await getNextFabricProReceiptNo(connection);
    connection.close()
    return res.json({ statusCode: 0, docId: fpdNo })
}

export async function create(req, res) {
    const connection = await getConnection(res)
    const { supplierId: gtCompMastId, remarks: REMARKS, vehicleNo: VEHICLENO, supplierDcDate: DCDATE, supplierDcNo: SUPPDCNO, deliveryDetails, consDetails, fpdNo, docNo } = req.body;
    console.log(req.body, 'docNo');
    try {
        if (!gtCompMastId) {
            return res.json({ statusCode: 1, message: 'Required Fields: supplierId, deliveryDetails' });
        }

        if (deliveryDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Delivery Details Cannot be Empty' });
        }
        const FPDDATE = moment(new Date()).format("DD-MM-YYYY");
        const FINYEAR = await getCurrentFinancialYearId(connection);
        const FPDNO = await getNextFabricProReceiptNo(connection);
        const SUPPLIER = await getSupplierName(connection, gtCompMastId);
        const TOTALQTY = deliveryDetails.reduce((a, c) => a + parseFloat(c.jobQty), 0);
        const sqlData = `
        select BUYERCODE, PROCESSNAME,PRE,GTFABPROJOBORDID,orderNo,JOBTYPE
   from GTFABPROJOBORD where GTFABPROJOBORD.GTFABPROJOBORDID = :docNo
      `;
        const jobDetails = await connection.execute(sqlData, { docNo: docNo });
        console.log(fpdNo, 'job');
        if (!jobDetails) return res.json({ statusCode: 1, message: 'Job Not Found' });
        const [BUYERCODE, PROCESSNAME, PRE, GTYARNPROJOID, ORDERNO, JOBTYPE] = jobDetails.rows[0];
        const nonGridSql = `
        INSERT INTO GTFABPROREC (GTFABPRORECID, STOREID, FINYEAR, COMPCODE, TCODE, TTYPE, PTRANSACTION, FROMCOMP,REMARKS, VEHICLENO, LOCID,
            SUPPLIER, suppDate,
                    suppDc, FPDDATE, FPDNO,PROJECTID,TOTALQTY,
                             BUYERCODE,PROCESSNAME, JOBNO, ORDERNO,TRANSTYPE,PRE)
        VALUES ( supplierseq.nextVal, '${STOREID}', '${FINYEAR}' , '${COMPCODE}' , '${TCODE}' , '${PRO_TTYPE}' , '${FABRIC_PROCESS_RECEIPT_PTRANSACTION}' , '${gtCompMastId}' ,'${REMARKS}' ,
             '${VEHICLENO}' , '${LOCID}' , '${SUPPLIER}', TO_DATE('${DCDATE}', 'DD/MM/YY'), '${SUPPDCNO}', TO_DATE('${FPDDATE}','DD/MM/YY'), '${FPDNO}',
             '${PROJECTID}','${TOTALQTY}',
             '${BUYERCODE}','${PROCESSNAME}','${GTYARNPROJOID}','${ORDERNO}', '${ORDERTRANSTYPE}', '${PRE}')
        `;
        console.log(nonGridSql, 'nonGridSql');
        const nonGridResult = await connection.execute(nonGridSql)
        const lastRowData = await connection.execute(`
        select GTFABPRORECID from GTFABPROREC where rowid = '${nonGridResult.lastRowid}'
        `)
        const GTFABPRORECID = lastRowData.rows[0][0]
        console.log(GTFABPRORECID, 'GTFABPRORECID');
        await (async function createGridDetails() {
            const promises = deliveryDetails.map(async (deliveryItem) => {
                console.log(deliveryItem.gtFabProJobOrdDetId, 'id');
                const gridSqlDet = (`
                SELECT 
                det.aliasname,
                det.color,
                det.buyercode1,
                det.uom,
                det.processname1,
                det.jobPrice,
                det.tax,
                det.orderno1,
                det.jobQty,
                po.GTFABPROJOBORDID,
                po.FPJDATE,
                det.TOTALRECQTY,
                det.jobPrice,
                gtfabricmast.fabric,
                gtunitmast.unitname,
                gtcolormast.colorname,
                gtbuyermast.buyercode,
               det.processName1,
                gtFinancialyear.finyr,
                det.issQty,
                det.fabtype,
                det.design,
                det.kDia,
                det.fDia,
                det.gg,
                det.gsm,
                det.ll
            FROM 
                GTFABPROJOBORDDET det
            JOIN 
                GTFABPROJOBORD po ON det.GTFABPROJOBORDID = po.GTFABPROJOBORDID
                left join gtfabricMast on gtfabricMast.gtfabricMastid = det.aliasname
                left join gtunitmast on gtunitmast.GTUNITMASTID = det.uom
                left join gtcolormast on gtcolormast.GTCOLORMASTID = det.COLOR
                left join gtbuyermast on gtbuyermast.buyercode = det.buyercode1
                             left join gtFinancialYear on gtFinancialYear.GTFINANCIALYEARID = po.finyear
            WHERE 
                det.gtFabProJobOrdDetId= ${deliveryItem.gtFabProJobOrdDetId}
            `);
                console.log(gridSqlDet, 'det 94');
                let gtFabricProDetResult = await connection.execute(gridSqlDet);
                console.log(gtFabricProDetResult.rows[0], 'res');
                const [yarnname,
                    color,
                    buyercode,
                    uom,
                    processname,
                    proamount,
                    tax,
                    orderNo,
                    jobQty,
                    GTFABPROJOBORDID,
                    jobDate,
                    TOTALRECQTY,
                    jobPrice,
                    fabAliasName, unitName, colorName, buyerCode, processName, finYearCode, issQty, fabricType, design, kDia, fDia, gg, gsm, ll] = gtFabricProDetResult.rows[0];

                console.log(gtFabricProDetResult.rows[0], 'res');
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
                INSERT INTO GTFABPRORECDTL (
                    GTFABPRORECDTLID,
                    GTFABPRORECID,
                    Fabric,
                    COLOR,
                    UOM,
                    TAXRATE,
                    jobId,
                    JOBQTY,
                    recRoll,
                    RECQTY,
                    EXCESSQTY,
                    LOTNO1,
                    jobPrice,
                    totRecQty,
                    issueQty,
                    kdia,
                    fDia,
                    gg,
                    ll,
                    gsm,
                    fabrictype,
                    design,
                    detailId
                )
                VALUES(supplierseq.nextVal, '${GTFABPRORECID}', '${yarnname}', '${color}',
                    '${uom}', '${taxRate}', '${deliveryItem.gtFabProJobOrdDetId}', '${jobQty}', 
                    '${deliveryItem.rolls}', '${deliveryItem.recQty}', '${excessQty}',
                    '${deliveryItem.lotNo}', '${jobPrice}', '${totalRecQty}', '${deliveryItem.issQty}', '${kDia}','${fDia}','${gg}','${ll}','${gsm}','${fabricType}', '${design}','${deliveryItem.gtFabProJobOrdDetId}')
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
                    '${finYearCode}', '${COMPSHORTCODE}', '${FPDNO}', TO_DATE('${FPDDATE}', 'DD-MM-YYYY'), 'P', '${FABRIC_PROCESS_RECEIPT_PTRANSACTION}','${orderNo}', 
                    '${fabAliasName}', '${colorName}', '${unitName}', '${totalRecQty}', ${jobPrice}, '${taxRate}' , '${jobPrice * totalRecQty}',
                    '${totalRecQty * grnQty}', 
                    '${LOCID}', '${STORES}','${processName}', '${jobPrice}', '${taxRate}', '${TRANSTYPE}', '${REC_STOCK_TYPE}','${buyerCode}','${fabricType}','${design}')`;
                console.log(stockSql, 'stockSql');
                await connection.execute(stockSql);
                const accumulatedGrnQty = parseFloat(TOTALRECQTY ? TOTALRECQTY : 0) + parseFloat(totalRecQty);
                console.log(accumulatedGrnQty, 'accumulatedGrnQty');
                const updatePoDetSql = `
                UPDATE GTFABPROJOBORDDET 
                SET totalRecQty = ${accumulatedGrnQty},
                    excessQty = ${excessQty},
                recQty = ${substract(accumulatedGrnQty, excessQty)}
                WHERE   GTFABPROJOBORDDET.gtFabProJobOrdDetId= ${deliveryItem.gtFabProJobOrdDetId
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
                det.aliasname1,
                det.DESIGN1,
                det.uom1,
                det.FDIA1,
                det.COLOR1,
                det.KDIA1,
                det.FABRIC1,
                det.GG1,
                det.prevProcessName,
                det.ISSUEQTY1,
                det.rate,
                det.taxrate1,
                det.gtfabprodelsubid,
                det.fabrictype1,
                det.gsm1,
                det.ISSUEROLL1,
                det.fabric1,
                det.fabricType1,
                det.knitCounts,
                det.lotNo,
                det.ll1
                     FROM 
                GTFABPRODELSUB det   
                     WHERE 
                det.GTFABPRODELSUBID
                = ${consItems.gtfabprodelsubid
                    }
                `)
                const [aliasName, design, uom, fDia, color, kDia, fabric, gg, prevProcess, issQty, rate, taxRate, gtfabprodelsubid, fabrictype1, gsm, issRoll, fabricName, fabType, knitCounts, lotNo, ll1] = gtYarnProDetResult1.rows[0]
                console.log(gtYarnProDetResult1.rows[0], 'cons');

                const gridSql1 = `
                INSERT INTO gtFabProRecSub (
                    gtFabProRecSubid,
                    GTFABPRORECID,
                    ALIASNAME1,
                    COLOR1,
                    UOM1,
                    TAXRATE1,
                    issueQty1,
                    lossQty,
                    RecQty1,
                    LOTNO,
                    Fdia1,
                    kDia1,
                    ll1,
                    gg1,
                    gsm1,
                    prevProcessName,
                    stockType
                )
                VALUES(supplierseq.nextVal,
                     '${GTFABPRORECID}',
                      '${aliasName}', 
                      '${color}',
                    '${uom}',
                     '${taxRate}',
                     '${issQty}',
                    '${consItems.lossQty}',
                    '${consItems.issRecQty}',
                    '${lotNo}',
                    '${fDia}',
                    '${kDia}',
                    '${ll1}',
                    '${gg}',
                    '${gsm}',
                    '${prevProcess}',
                    '${STOCKTTYPE}'
                                     )
            `
                console.log(gridSql1, 'const gridSql1');
                await connection.execute(gridSql1)
            })
            return Promise.all(consPromises)
        })()
        await getNextFabricProReceiptNo(connection)
        connection.commit()
        return res.json({ statusCode: 0, data: GTFABPRORECID })
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
GTFABPRORECDTL.poNo,
GTFABPRORECDTL.orderNo,
GTFABPRORECDTL.totalgrnQty,
GTFABPRORECDTL.poPrice,
GTFABPRORECDTL.balQty,
GTFABPRORECDTL.jobQty,
GTFABPRORECDTL.grnBags,
GTFABPRORECDTL.lotNo,
GTFABPRORECDTL.agrnQty,
GTFABPRORECDTL.gtFabProRecDtlIid
,
gtYarnPoDet.gtYarn  gtFabProJobOrdDetId,
del.docid,
poBags,
del.delTO,
GTFABPRORECDTL.remarks, 
GTFABPRORECDTL.vehicleno,
GTFABPRORECDTL.ypoino,
GTFABPRORECDTL.IS_REC
FROM
GTFABPRORECDTL
JOIN
gtYarnMaster ON gtYarnMaster.gtYarnMasterId = GTFABPRORECDTL.YARNNAME
JOIN
gtColorMast ON gtColorMast.gtColorMastId = GTFABPRORECDTL.COLORNAME
JOIN
gtYarnPoDet ON gtYarnPoDet.  gtFabProJobOrdDetId
 = GTFABPRORECDTL.  gtFabProJobOrdDetId
JOIN                  
GTFABPRORECDTL ON GTFABPRORECDTL.gtYarnPoInwardId = GTFABPRORECDTL.gtYarnPoInwardId
JOIN 
GTFABPROJOBORD deL ON del.GTFABPROJOBORDID = gtYarnPoDet.GTFABPROJOBORDID
JOIN 
gtCompMast supp ON supp.compName1 = DEL.DELTO 
    where  SUPP.gtCompMastId = :gtCompMastId
    ${isRec ?
                    `AND GTFABPRORECDTL.IS_REC = ${isRec === 'true' ? 1 : 0}`
                    :
                    ""}
   `
            result = await connection.execute(sql, { gtCompMastId })
            const resp = result.rows.map(del => ({
                yarn: del[0], color: del[1], poId: del[2], poNo: del[13], orderNo: del[3],
                delQty: del[4], poPrice: del[5], balQty: del[6], jobQty: del[7],
                delBags: del[8], lotNo: del[9], aDelQty: del[10], gtFabProRecDtlIid
                    : del[11], gtFabProJobOrdDetId
                    : del[12], poBags: del[14], delTO: del[15], remarks: del[16], vehNo: del[17],
                ypoino: del[18], isReceived: del[19]
            }))

            return res.json({ statusCode: 0, data: resp })
        } else {
            result = await connection.execute(`
            select 
            gtFabProRec.remarks,
            gtFabProRec.supplier,
            gtFabProRec.SUPPDATE,
            gtFabProRec.suppDC,
            gtFabProRec.TOTALQTY,
            gtFabProRec.JOBDATE,
            gtFabProRec.FPDNO,
            gtFabProRec.jobno,
            gtFabProRec.VEHICLENO,
            gtFabProRec.gtFabProRecId
                       from 
            gtFabProRec 
                 JOIN   gtCompMast ON gtCompMast.compName1 =  gtFabProRec.supplier
            WHERE 
                 gtCompMast.gtCompMastId = :gtCompMastId
 
    `, { gtCompMastId })
            const resp = result.rows.map(del => ({
                remarks: del[0], supplier: del[1], dcDate: del[2], supplierDcNo: del[3], totalQty: del[4],
                jobDate: del[5], recNo: del[6], jobNo: del[7], vehNo: del[8], gtFabProRecId: del[9]
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
        const { gtFabProRecDtlIid
        } = req.query;
        const response = await connection.execute(`
        UPDATE GTFABPRORECDTL a
        SET a.IS_REC = 1
        WHERE a.gtFabProRecDtlIid
 = :gtFabProRecDtlIid

                        `, {
            gtFabProRecDtlIid
        });

        connection.commit();

        if (response.rowsAffected === 1) {
            return res.json({ statusCode: 0, data: "Purchase Order Accepted" });
        } else {
            return res.json({ statusCode: 1, data: "fpdNo Does not Exist" });
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
        const { fpdNo } = req.query
        console.log(fpdNo, 'isno');
        const result = await connection.execute(`
        SELECT
       gtfabricmast .FABRIC,
        gtColorMast.colorName,
       GTFABPRORECDTL.jobQty,
       GTFABPRORECDTL.issueQty,
       GTFABPRORECDTL.jobPrice,
       GTFABPRORECDTL.excessQty,
       gtunitmast.unitName,
       GTFABPRORECDTL.recroll,
       GTFABPRORECDTL.GTFABPRORECDTLid,
       GTFABPRORECDTL.totrecqty,
       GTFABPRORECDTL. RECQTY,
       GTFABPRORECDTL.LOTNO1,
        gtFabProRec.jobno,
       GTFABPRORECDTL.ll,
       GTFABPRORECDTL.gg,
       GTFABPRORECDTL.gsm,
       GTFABPRORECDTL.kdia,
       gtfabricMast.fabric,
       gtfabtypeMast.fabtype,
       GTFABPRORECDTL.jobid
           FROM
       GTFABPRORECDTL
   JOIN
       gtColorMast ON gtColorMast.gtColorMastId = GTFABPRORECDTL.COLOR
   JOIN
       gtFabProRec ON gtFabProRec.gtFabProRecid = GTFABPRORECDTL.gtFabProRecid
   left join 
       gtyarnmaster on gtyarnmaster.gtyarnmasterid = GTFABPRORECDTL.aliasname
   left join 
       gtfabricmast on gtfabricmast.gtfabricmastid = GTFABPRORECDTL.fabric
    left join gtunitmast on gtunitmast.gtunitmastid = GTFABPRORECDTL.uom 
    left join gtfabtypemast on gtfabtypeMast.gtfabtypeMastid =  GTFABPRORECDTL.fabricType
    left join GTFABPROJOBORDDET on GTFABPROJOBORDDET.GTFABPROJOBORDDETID = GTFABPRORECDTL.jobid
   WHERE
   gtFabProRec.gtFabProRecId = : fpdNo

        `, { fpdNo })
        const resp = result.rows.map(del => ({
            fabric: del[0], color: del[1], jobQty: del[2], issQty: del[3], jobPrice: del[4],
            excessQty: del[5], uom: del[6], rolls: del[7], gtFabProRecDtlIid
                : del[8],
            totalrecQty: del[9], recQty: del[10], lotNo: del[11], jobId: del[12], ll: del[13], gg: del[14], gsm: del[15], kdia: del[16], fabric: del[17], fabtype: del[18], gtFabProJobOrdDetId: del[19]
        }))
        console.log(resp, 'resp');
        const result1 = await connection.execute(`
        select
        gtFabProRec.remarks,
        gtFabProRec.suppdc,
        gtFabProRec.fpDDate,
        gtFabProRec.fpDno,
        gtFabProRec.vehicleno,
        gtFabProRec.supplier,
        gtcompmast.compname,
        gtFabProRec.GTFABPRORECID,
        GTFABPROJOBORD.fpJNo,
        gtprocessMast.PROCESSNAME
        from 
        gtFabProRec
        left join gtcompmast on gtcompmast.GTCOMPMASTID =  gtFabProRec.compcode
        left join GTFABPROJOBORD on GTFABPROJOBORD.GTFABPROJOBORDID = gtFabProRec.jobNo
        left join gtprocessmast on gtprocessmast.GTPROCESSMASTID = gtFabProRec.PROCESSNAME   
   WHERE
        gtFabProRec.gtFabProRecid = : fpdNo
        `, { fpdNo })

        const po = result1.rows[0]
        const delNonGridDetails = {
            remarks: po[0], supplierDcNo: po[1], dcDate: po[2], recNo: po[3],
            vehicleNo: po[4], supplier: po[5], comName: po[6], receiptId: po[7], fpdNo: po[8], processName: po[9]
        }
        console.log(delNonGridDetails, 'delNonGridDetails');
        const ConsumptionDet = await connection.execute(`
        select
        gtFabProRecSub.gtFabProRecSubid,
        gtFabProRecSub.GTFABPRORECID,
        gtFabricMast.fabric,
        gtcolormast.colorName,
        gtunitMast.unitName,
        gtFabProRecSub.TAXRATE1,
        gtFabProRecSub.issueQty1,
        gtFabProRecSub.lossQty,
        gtFabProRecSub.RecQty1,
        gtFabProRecSub.LOTNO,
        gtFabProRecSub.issno1,
        gtFabProRec.FPDNO
         from 
        gtFabProRecSub 
 LEFT JOIN 
        gtcolormast on gtcolormast.gtcolormastid = gtFabProRecSub.COLOR1       
 left join 
        gtFabricmast on gtFabricmast.gtFabricmastid = gtFabProRecSub.FABRIC1
 left join 
        gtunitMast on gtunitMast.gtunitMastid = gtFabProRecSub.uom1 
 left join gtFabProRec on gtFabProRecSub.gtFabProRecID = gtFabProRec.GTFABPRORECID 
 where
 gtFabProRec.gtFabProRecID = : fpdNo
 `, { fpdNo })
        const stock = ConsumptionDet.rows.map(stc => ({
            stockId: stc[0], receiptId: stc[1], fabric: stc[2], color: stc[3], uom: stc[4], tax: stc[5], issQty: stc[6], lossQty: stc[7], issRecQty: stc[8], lotNo: stc[9], issueNo: stc[10], FPDNO: stc[11]
        }))

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
            return res.json({ statusCode: 1, message: 'Required Fields: fpdNo , deliveryDetails' });
        }
        if (deliveryDetails && consDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Delivery Details Cannot be Empty' });
        }

        const TOTALQTY = deliveryDetails.reduce((a, c) => a + parseFloat(c.delQty), 0);

        const nonGridSql = `
            UPDATE GTFABPROREC
            SET vehicleNo = '${vehicleNo}',
                remarks = '${remarks}',
                SUPPDATE = TO_DATE('${supplierDcDate}', 'DD-MM-YYYY'),
                SUPPDC = '${supplierDcNo}'
                          WHERE GTFABPRORECID= '${delNo}'
        `;

        console.log(nonGridSql, 'nonsql');
        const nonGridResult = await connection.execute(nonGridSql);
        const lastRowData = await connection.execute(`
        select GTFABPRORECID,fpDDate,fpdno from GTFABPROREC where rowid = '${nonGridResult.lastRowid}'
        `)
        console.log(lastRowData, 'lastRowData');
        const [GTFABPRORECID, FPDDATE, FPDNO] = lastRowData.rows[0]

        let oldDeliveryDetailsItems = await connection.execute(`SELECT GTFABPRORECDTLID from GTFABPRORECDTL
        WHERE GTFABPRORECID = ${GTFABPRORECID}`)
        oldDeliveryDetailsItems = oldDeliveryDetailsItems.rows.map(item => item[0])

        const newUpdateDeliveryItemsIds = deliveryDetails.filter(item => item?.gtFabProRecDtlIid
        ).map(item => item?.gtFabProRecDtlIid
        )

        const removedItems = getRemovedItems(oldDeliveryDetailsItems, newUpdateDeliveryItemsIds);

        if (removedItems.length > 0) {
            await connection.execute(`DELETE FROM GTFABPRORECDTL WHERE GTFABPRORECDTLID IN (${removedItems}) `)
        }
        await deleteYarnStock(connection, delNo)
        await (async function updateGridDetails() {
            const promises = deliveryDetails.map(async (deliveryItem) => {
                const alreadyGrnResult = await connection.execute(`
                select COALESCE(sum(totrecqty),0 ) 
                from GTFABPRORECDTL 
                    where   jobId
 = ${deliveryItem.jobId} and GTFABPRORECID < ${GTFABPRORECID}
                    `)
                const [TOTALRECQTY] = alreadyGrnResult.rows[0]
                const gridsql = `
                select
                aliasname,
               det.color,
                det.uom,
               det.processname1,
                jobPrice,
                tax,
                orderno,
                jobQty,
                po.GTFABPROJOBORDID,
                po.FPJDATE,
                gtfabricmast.fabric,
                gtunitmast.unitname,
                gtcolormast.colorname,
                gtbuyermast.buyercode,
                det.PROCESSNAME1,
                fy.finyr,
                jobPrice
            from GTFABPROJOBORDDET det
            left join GTFABPROJOBORD po on det.GTFABPROJOBORDID = po.GTFABPROJOBORDID
            LEFT JOIN gtfinancialYear fy on fy.gtfinancialYearid = po.finYear
            left join gtfabricmast on gtfabricmast.gtfabricmastid = det.aliasname
          left  join gtunitmast on gtunitmast.GTUNITMASTID = det.uom
            left join gtcolormast on gtcolormast.GTCOLORMASTID = det.COLOR
            left join gtbuyermast on gtbuyermast.buyerCode = det.buyercode1
                                                            where gtFabProJobOrdDetId
 =${deliveryItem.gtFabProJobOrdDetId
                    }
                `; console.log(gridsql, 'gridsql');
                const gtYarnPoDetResult = await connection.execute(gridsql)
                const [yarnname, color, uom, processname, proamount, tax, orderNo, jobQty, GTFABPROJOBORDID, jobDate, fabAliasName, unitName, colorName, buyerCode, proName, finYearCode, jobPrice] = gtYarnPoDetResult.rows[0]
                const taxRate = jobPrice + (jobPrice / 100 * tax)
                const balQty = parseFloat(jobQty) - parseFloat(TOTALRECQTY)
                const totalRecQty = parseFloat(deliveryItem.recQty);
                console.log(deliveryItem.totalrecQty, 'recqty');
                let grnQty = totalRecQty;
                let excessQty = 0;
                if (grnQty > balQty) {
                    grnQty = balQty
                    excessQty = totalRecQty - balQty
                }
                console.log(FPDDATE, 'FPDDATE');
                const stockSql = `INSERT INTO gtfabricstockmast (gtfabricstockmastid, TAXRMRATE, RMRATE, PROJECTID, IS_CANCELLED,
                    STOCKQTY, EXCESSQTY,COMPNAME, LOTNO,
                    FINYEAR,COMPCODE, DOCID, DOCDATE, PLUSORMINUS, TRANSTYPE, ORDERNO,
                    FABRIC, COLOR, UOM, QTY,
                    RATE, TAXRATE,AMOUNT,TAXAMT,
                    LOCID,STOREID,PROCESSNAME,TOTALRATE,TAXTOTALRATE,ORDERTRANSTYPE, STOCKTYPE)
                    VALUES(supplierseq.nextVal, 0, 0, '${PROJECTID}', 'F', 
                    '${totalRecQty}', '${excessQty}', '${COMPNAME}', '${deliveryItem.lotNo}', 
                    '${finYearCode}', '${COMPSHORTCODE}','${FPDNO}', TO_TIMESTAMP('${moment(FPDDATE).format("YYYY-MM-DD ")}', 'YYYY-MM-DD'),  'P', '${FABRIC_PROCESS_RECEIPT_PTRANSACTION}','${orderNo}', 
                    '${fabAliasName}', '${colorName}', '${unitName}', '${totalRecQty}', '${jobPrice}', '${taxRate}' , '${jobPrice * totalRecQty}',
                    '${totalRecQty * grnQty}', 
                    '${LOCID}', '${STORES}','${proName}', '${jobPrice}', '${taxRate}', '${TRANSTYPE}', '${REC_STOCK_TYPE}')`;
                console.log(stockSql, 'stocksql');
                await connection.execute(stockSql);
                if (deliveryItem?.gtFabProRecDtlIid

                ) {
                    const gridSql = `
                                UPDATE gtFabProRecDtl
                                SET totRecQty = '${totalRecQty}',
                                recQty = '${deliveryItem.recQty}',
                                lotNo1 = '${deliveryItem.lotNo}' 
                                WHERE gtFabProRecDtlid
 = '${deliveryItem?.gtFabProRecDtlIid
                        }'
                            `;
                    console.log(gridSql, 'u grid sql');
                    await connection.execute(gridSql)
                } else {
                    const convertedPoDate = moment(jobDate).format("DD-MM-YYYY")
                    const gridSql = `
                INSERT INTO GTFABPRORECDTL (gtFabProRecDtlIid
,GTFABPRORECID,YARNPROCESS,BUYERCODE, YARNNAME, COLORNAME, JOBNO, 
                    UOM,AGRNQTY, TAXRATE,   gtFabProJobOrdDetId, ORDERNO, GRNQTY, 
                    BALQTY, POPRICE, POQTY, GRNBAGS, TOTALGRNQTY, LOTNO, POBAGS, POTYPE, PODATE, TRANSTYPE, EXCESSQTY)
                    VALUES(supplierseq.nextVal, ${GTFABPRORECID},'${processname}','${buyerCode}', '${yarnname}', '${color}', '${GTFABPROJOBORDID}', 
                    '${uom}', ${TOTALRECQTY}, ${taxRate}, '${deliveryItem.gtFabProJobOrdDetId
                        }', '${orderNo}', ${grnQty}, 
                    ${balQty}, ${proamount}, ${jobQty}, ${deliveryItem.delBags}, ${totalRecQty}, '${deliveryItem.lotNo}', ${poBags}, '${POTYPE}', 
                    TO_DATE('${convertedPoDate}', 'DD-MM-YYYY'), '${TRANSTYPE}', ${excessQty}  )
                    `
                    console.log(gridSql, ' gridSql 536');
                    await connection.execute(gridSql)
                }
                const accumulatedGrnQty = parseFloat(TOTALRECQTY ? TOTALRECQTY : 0) + parseFloat(totalRecQty);
                const updatePoDetSql = `
                UPDATE GTFABPROJOBORDDET 
                SET totalRecQty = ${accumulatedGrnQty},
                excessQty = ${excessQty},
                recQty = ${substract(accumulatedGrnQty, excessQty)}
                WHERE   gtFabProJobOrdDetId
 = ${deliveryItem.gtFabProJobOrdDetId
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



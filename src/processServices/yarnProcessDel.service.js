import { getConnection } from "../constants/db.connection.js";
import { getCurrentFinancialYearId } from "../queries/financialYear.js";
import { STOREID, COMPCODE, COMPNAME, PROJECTID, TCODE, PRO_TTYPE, LOCID, POTYPE, TRANSTYPE, REC_STOCK_TYPE, COMPSHORTCODE, YARN_STORE_NAME, ORDERTRANSTYPE, YARN_PROCESS_RECEIPT_PTRANSACTION } from "../constants/defaultQueryValues.js"
import { getNextYarnProReceiptNo } from "../queries/sequences.js";
import { getSupplierName } from "../queries/supplier.js";
import moment from "moment";
import { getRemovedItems, substract } from "../Helpers/helper.js";
import { deleteYarnStock } from "../queries/stockHelper.js";
export async function getDocId(req, res) {
    const connection = await getConnection(res)
    const ypIsNo = await getNextYarnProReceiptNo(connection);
    connection.close()
    return res.json({ statusCode: 0, docId: ypIsNo })
}
const date = new Date()
export async function create(req, res) {
    const connection = await getConnection(res)
    const { supplierId: gtCompMastId, remarks: REMARKS, vehicleNo: VEHICLENO, supplierDcDate: DCDATE, supplierDcNo: SUPPDCNO, deliveryDetails, consDetails, ypIsNo, docNo, userName } = req.body;

    try {
        if (!gtCompMastId) {
            return res.json({ statusCode: 1, message: 'Required Fields: supplierId, deliveryDetails' });
        }

        if (deliveryDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Delivery Details Cannot be Empty' });
        }
        const YPISDATE = moment(new Date()).format("DD-MM-YYYY");
        const FINYEAR = await getCurrentFinancialYearId(connection);
        const YPISNO = await getNextYarnProReceiptNo(connection);
        const SUPPLIER = await getSupplierName(connection, gtCompMastId);
        const TOTALQTY = deliveryDetails.reduce((a, c) => a + parseFloat(c.jobQty), 0);
        const sqlData = `
        SELECT BUYERCODE1, PROCESSNAME1,PRE,gtyarnprojoid,orderNo1,JOBTYPE1
        FROM gtyarnprojo
        WHERE gtyarnprojo.docid = :docNo
      `;
        const jobDetails = await connection.execute(sqlData, { docNo: docNo });
        console.log(ypIsNo, 'job');
        if (!jobDetails) return res.json({ statusCode: 1, message: 'Job Not Found' });
        const [BUYERCODE, PROCESSNAME, PRE, GTYARNPROJOID, ORDERNO, JOBTYPE] = jobDetails.rows[0];
        const totalIssQty = deliveryDetails.reduce((a, c) => a + parseFloat(c.recQty), 0);
        const nonGridSql = `
        INSERT INTO gtYarnProReceipt (GTYARNPRORECEIPTID, STOREDID, FINYEAR, COMPCODE, TCODE, TTYPE, PTRANSACTION,REMARKS, VEHICLENO, LOCID, SUPPLIER, partyDcDate,partyDcno, YPISDATE, YPISNO,PROJECTID,TOTALQTY,
            BUYERCODE,PROCESSNAME, JOBNO, ORDERNO,TRANSTYPE,JOBTYPE,PRE,ENTRYTYPE, USERID, created_by,CREATED_ON,totalIssueQty) 
        VALUES ( supplierseq.nextVal, '${STOREID}', '${FINYEAR}' , '${COMPCODE}' , '${TCODE}' , '${PRO_TTYPE}' , '${YARN_PROCESS_RECEIPT_PTRANSACTION}' ,'${REMARKS}' ,
             '${VEHICLENO}' , '${LOCID}' , '${SUPPLIER}', TO_DATE('${DCDATE}', 'DD/MM/YY'), '${SUPPDCNO}', TO_DATE('${YPISDATE}','DD/MM/YY'), '${YPISNO}',
             '${PROJECTID}','${totalIssQty}',
             '${BUYERCODE}','${PROCESSNAME}','${GTYARNPROJOID}','${ORDERNO}', '${ORDERTRANSTYPE}', '${JOBTYPE}','${PRE}','SP', '${userName}','${userName}',    TO_TIMESTAMP('${moment(date).format("YYYY-MM-DD HH:mm:ss")}', 'YYYY-MM-DD HH24:MI:SS.FF'),'${totalIssQty}')
        `;
        console.log(nonGridSql, 'nonGridSql');
        const nonGridResult = await connection.execute(nonGridSql)
        const lastRowData = await connection.execute(`
        select GTYARNPRORECEIPTID from gtYarnProReceipt where rowid = '${nonGridResult.lastRowid}'
        `)
        const GTYARNPRORECEIPTID = lastRowData.rows[0][0]
        await connection.execute(`
        UPDATE GTYARNPRORECEIPT SET versionid = ${GTYARNPRORECEIPTID} where rowid = '${nonGridResult.lastRowid}' 
        `)
        await (async function createGridDetails() {
            const promises = deliveryDetails.map(async (deliveryItem) => {

                let gtYarnProDetResult = await connection.execute(`
                SELECT 
                det.aliasname,
                det.color,
                det.buyercode,
                det.uom,
                det.processname,
                det.proamount,
                det.tax,
                det.orderno,
                det.jobQty,
                po.gtyarnprojoid,
                po.docdate,
                det.TOTALRECQTY,
                det.jobrate,
                 gtYarnMaster.yarnname,
                gtunitmast.unitname,
                 gtcolormast.colorname,
                  gtbuyermast.buyercode,
                  gtprocessmast.PROCESSNAME,
                   gtFinancialyear.finyr,
                   det.issQty
            FROM 
                gtyarnprojodet det
            JOIN 
                gtyarnprojo po ON det.gtyarnprojoid = po.gtyarnprojoid
                join gtYarnMaster on gtYarnMaster.GTYARNMASTERID = det.aliasname
                join gtunitmast on gtunitmast.GTUNITMASTID = det.uom
                join gtcolormast on gtcolormast.GTCOLORMASTID = det.COLOR
              left  join gtbuyermast on gtbuyermast.buyercode = det.buyercode
                join gtprocessmast on gtprocessmast.gtprocessmastid = det.PROCESSNAME  
                join gtFinancialYear on gtFinancialYear.GTFINANCIALYEARID = po.finyear
            WHERE 
                det.gtyarnprojodetid = ${deliveryItem.gtyarnprojodetid}
                `)
                const [yarnname,
                    color,
                    buyercode,
                    uom,
                    processname,
                    proamount,
                    tax,
                    orderNo,
                    jobQty,
                    gtyarnprojoid,
                    jobDate,
                    TOTALRECQTY,
                    jobRate,
                    yarnAliasName, unitName, colorName, buyerCode, processName, finYearCode, issQty] = gtYarnProDetResult.rows[0]
                const taxRate = jobRate + (jobRate / 100 * tax)
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
                INSERT INTO gtYarnProReceiptdet (
                    gtyarnproreceiptdetid,
                    GTYARNPRORECEIPTID,
                    ALIASNAME,
                    COLOR,
                    UOM,
                    TAXRATE,
                    DETAILID,
                    JOBQTY,
                    recbag,
                    RECQTY,
                    EXCESSQTY,
                    LOTNO1,
                    jobRate,
                    totalRecQty,
                    issQty,
                    balQty,
                    supdcQty
                )
                VALUES(supplierseq.nextVal, ${GTYARNPRORECEIPTID}, '${yarnname}', '${color}',
                    '${uom}', ${taxRate}, '${deliveryItem.gtyarnprojodetid}',  
               ${jobQty},  ${deliveryItem.recBag}, '${deliveryItem.recQty}', ${excessQty},${deliveryItem.lotNo} ,${jobRate},${totalRecQty},${issQty},${balQty},'${deliveryItem.recQty}' )
            `

                console.log(gridSql, 'create');
                await connection.execute(gridSql)
                const stockSql = `INSERT INTO gtyarnstockmast (GTYARNSTOCKMASTID, TAXRMRATE, RMRATE, PROJECTID, IS_CANCELLED, 
                    STOCKQTY, EXCESSQTY,COMPNAME, LOTNO, 
                    FINYEAR,COMPCODE, DOCID, DOCDATE, PLUSORMINUS, TRANSTYPE, ORDERNO, 
                    YARNNAME, COLOR, UOM, QTY, 
                    RATE, TAXRATE,AMOUNT,TAXAMT,
                    LOCID,STOREDID,PROCESSNAME,TOTALRATE,TAXTOTALRATE,ORDERTRANSTYPE, STOCKTYPE,BUYCODE,USERID, created_by,CREATED_ON,versionId) 
                    VALUES(supplierseq.nextVal, 0, 0, '${PROJECTID}', 'F', 
                    '${totalRecQty}', '${excessQty}', '${COMPNAME}', '${deliveryItem.lotNo}', 
                    '${finYearCode}', '${COMPSHORTCODE}', '${YPISNO}','${YPISDATE}', 'P', '${YARN_PROCESS_RECEIPT_PTRANSACTION}','${orderNo}', 
                    '${yarnAliasName}', '${colorName}', '${unitName}', '${totalRecQty}', ${jobRate}, '${taxRate}' , '${jobRate * totalRecQty}',
                    '${totalRecQty * grnQty}', 
                    '${LOCID}', '${YARN_STORE_NAME}','${processName}', '${jobRate}', '${taxRate}', '${TRANSTYPE}', '${REC_STOCK_TYPE}','${buyerCode}','${userName}','${userName}', TO_TIMESTAMP('${moment(date).format("YYYY-MM-DD HH:mm:ss")}', 'YYYY-MM-DD HH24:MI:SS.FF'), '${GTYARNPRORECEIPTID}')`;
                console.log(stockSql, 'stockSql');
                await connection.execute(stockSql);
                const accumulatedGrnQty = parseFloat(TOTALRECQTY ? TOTALRECQTY : 0) + parseFloat(totalRecQty);
                const updatePoDetSql = `
                UPDATE gtyarnprojodet 
                SET totalRecQty = ${accumulatedGrnQty},
                    excessQty = ${excessQty},
                recQty = ${substract(accumulatedGrnQty, excessQty)}
                WHERE   gtyarnprojodetid = ${deliveryItem.gtyarnprojodetid}`
                console.log(updatePoDetSql, 'updatePoDetSql');
                await connection.execute(updatePoDetSql)

            })

            return Promise.all(promises)
        })()
        await (async function createConsGridDetails() {
            console.log(consDetails, 'consDetails');
            const consPromises = consDetails.map(async (consItems) => {

                const gridSql = (`
                SELECT 
                det.aliasname,
                det.color,
                det.uom,
                det.issQty,
                det.jobRate,
                det.taxrate,
                det.jobQty,
                det.gtyarnprojodetid,
                det.TOTALRECQTY,
                det.issNo,
                det.gtyarnProIssueDetid,
                gtyarnproissue.gtyarnproissueid,
                det.issid
                          FROM 
            gtyarnproissuedet det
            left  join gtyarnproissue on gtyarnproissue.gtyarnproissueid = det.gtyarnproissueid
            WHERE 
                det.gtyarnProIssueid = ${consItems.gtyarnProIssueid}
                `)
                let gtYarnProDetResult1 = await connection.execute(gridSql)
                console.log(gridSql, 'grid');
                const [yarnname, color, uom, issQty, jobRate, taxRate, jobQty, gtyarnprojodetid, totalrecqty, issNo, detId, issNo1, issid] = gtYarnProDetResult1.rows[0]

                console.log(gtYarnProDetResult1.rows[0], 'cons');
                const gridSql1 = `
                INSERT INTO gtyarnproreceiptstock (
                    gtyarnproreceiptstockid,
                    GTYARNPRORECEIPTID,
                    ALIASNAME1,
                    COLOR1,
                    UOM1,
                    TAXRATE1,
                    issQty1,
                    lossQty,
                    issRecQty,
                    LOTNO,
                    issNo1
                )
                VALUES(supplierseq.nextVal,
                     ${GTYARNPRORECEIPTID},
                      '${yarnname}', 
                      '${color}',
                    '${uom}',
                     ${taxRate},
                     ${issQty},
                    ${consItems.lossQty},
                    '${consItems.issRecQty}'
                    ,${consItems.lotNo},
                    ${issNo1}  )
            `
                console.log(gridSql1, 'const gridSql1');
                await connection.execute(gridSql1)


            })
            return Promise.all(consPromises)
        })()
        await getNextYarnProReceiptNo(connection)
        connection.commit()
        return res.json({ statusCode: 0, data: GTYARNPRORECEIPTID })
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
gtyarnproreceiptdet.poNo,
gtyarnproreceiptdet.orderNo,
gtyarnproreceiptdet.totalgrnQty,
gtyarnproreceiptdet.poPrice,
gtyarnproreceiptdet.balQty,
gtyarnproreceiptdet.jobQty,
gtyarnproreceiptdet.grnBags,
gtyarnproreceiptdet.lotNo,
gtyarnproreceiptdet.agrnQty,
gtyarnproreceiptdet.gtyarnproreceiptdetid,
gtYarnPoDet.gtYarn  gtyarnprojodetid,
del.docid,
poBags,
del.delTO,
gtyarnproreceiptdet.remarks, 
gtyarnproreceiptdet.vehicleno,
gtyarnproreceiptdet.ypoino,
gtyarnproreceiptdet.IS_REC
FROM
gtyarnproreceiptdet
JOIN
gtYarnMaster ON gtYarnMaster.gtYarnMasterId = gtyarnproreceiptdet.YARNNAME
JOIN
gtColorMast ON gtColorMast.gtColorMastId = gtyarnproreceiptdet.COLORNAME
JOIN
gtYarnPoDet ON gtYarnPoDet.  gtyarnprojodetid = gtyarnproreceiptdet.  gtyarnprojodetid
JOIN                  
gtyarnproreceiptdet ON gtyarnproreceiptdet.gtYarnPoInwardId = gtyarnproreceiptdet.gtYarnPoInwardId
JOIN 
gtyarnprojo deL ON del.gtyarnprojoid = gtYarnPoDet.gtyarnprojoid
JOIN 
gtCompMast supp ON supp.compName1 = DEL.DELTO 
    where  SUPP.gtCompMastId = :gtCompMastId
    ${isRec ?
                    `AND gtyarnproreceiptdet.IS_REC = ${isRec === 'true' ? 1 : 0}`
                    :
                    ""}
   `
            result = await connection.execute(sql, { gtCompMastId })
            const resp = result.rows.map(del => ({
                yarn: del[0], color: del[1], poId: del[2], poNo: del[13], orderNo: del[3],
                delQty: del[4], poPrice: del[5], balQty: del[6], jobQty: del[7],
                delBags: del[8], lotNo: del[9], aDelQty: del[10], gtyarnproreceiptdetid: del[11], gtyarnprojodetid: del[12], poBags: del[14], delTO: del[15], remarks: del[16], vehNo: del[17],
                ypoino: del[18], isReceived: del[19]
            }))

            return res.json({ statusCode: 0, data: resp })
        } else {
            result = await connection.execute(`
            select 
            gtyarnproreceipt.remarks,
            gtyarnproreceipt.supplier,
            gtyarnproreceipt.PARTYDCDATE,
            gtyarnproreceipt.PARTYDCNo,
            gtyarnproreceipt.TOTALISSUEQTY,
            gtyarnproreceipt.TOTALQTY,
            gtyarnproreceipt.JOBDATE,
            gtyarnproreceipt.YPISNO,
            gtyarnproreceipt.jobno,
            gtyarnproreceipt.VEHICLENO,
            gtyarnproreceipt.gtyarnproreceiptid
                       from 
            gtyarnproreceipt
                 JOIN   gtCompMast ON gtCompMast.compName1 =  gtyarnproreceipt.supplier
            WHERE 
                 gtCompMast.gtCompMastId = :gtCompMastId
 
    `, { gtCompMastId })
            const resp = result.rows.map(del => ({
                remarks: del[0], supplier: del[1], dcDate: del[2], supplierDcNo: del[3], issQty: del[4], totalQty: del[5],
                jobDate: del[6], recNo: del[7], jobNo: del[8], vehNo: del[9], gtyarnproreceiptId: del[10]
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
        const { gtyarnproreceiptdetid } = req.query;
        const response = await connection.execute(`
        UPDATE gtyarnproreceiptdet a
        SET a.IS_REC = 1
        WHERE a.gtyarnproreceiptdetid = :gtyarnproreceiptdetid
                        `, { gtyarnproreceiptdetid });

        connection.commit();

        if (response.rowsAffected === 1) {
            return res.json({ statusCode: 0, data: "Purchase Order Accepted" });
        } else {
            return res.json({ statusCode: 1, data: "ypIsNo Does not Exist" });
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
        const { ypIsNo } = req.query
        console.log(ypIsNo, 'isno');
        const result = await connection.execute(`
        SELECT
        gtyarnmaster.yarnname,
        gtColorMast.colorName,
       gtyarnproreceiptdet.jobQty,
       gtyarnproreceiptdet.issQty,
       gtyarnproreceiptdet.jobRate,
       gtyarnproreceiptdet.excessQty,
       gtunitmast.unitName,
       gtyarnproreceiptdet.recbag,
       gtyarnproreceiptdet.gtyarnproreceiptdetid,
       gtyarnproReceiptdet.totalrecqty,
       gtyarnproreceiptdet. RECQTY,
       gtyarnProReceiptDet.LOTNO1,
       gtyarnproreceiptdet.DETAILID,
       gtyarnproreceipt.jobno
           FROM
       gtyarnproreceiptdet
   JOIN
       gtColorMast ON gtColorMast.gtColorMastId = gtyarnproreceiptdet.COLOR
   JOIN
       gtyarnproreceipt ON gtyarnproreceipt.gtyarnproreceiptid = gtyarnproreceiptdet.gtyarnproreceiptid
   left join 
       gtyarnmaster on gtyarnmaster.gtyarnmasterid = gtyarnproreceiptdet.aliasname
          left join gtunitmast on gtunitmast.gtunitmastid = gtyarnproreceiptdet.uom
   WHERE
   gtyarnproreceipt.gtyarnproreceiptid = : ypIsNo

        `, { ypIsNo })
        const resp = result.rows.map(del => ({
            yarn: del[0], color: del[1], jobQty: del[2], issQty: del[3], jobRate: del[4],
            excessQty: del[5], uom: del[6], recBag: del[7], gtyarnproreceiptdetid: del[8],
            totalrecQty: del[9], recQty: del[10], lotNo: del[11], gtyarnprojodetid: del[12], jobId: del[13]
        }))

        const result1 = await connection.execute(`
        select  gtyarnproreceipt.remarks,
        gtyarnproreceipt.partyDcNo,
        gtyarnproreceipt.ypisDate,
        gtyarnproreceipt.ypisno,
        gtyarnproreceipt.vehicleno,
        gtyarnproreceipt.supplier,
        gtcompmast.compname,
        gtyarnproreceipt.GTYARNPRORECEIPTID,
        gtyarnprojo.docid,
        gtprocessMast.PROCESSNAME
        from 
        gtyarnproreceipt
        left join gtcompmast on gtcompmast.GTCOMPMASTID =  gtyarnproreceipt.compcode
        left join gtyarnprojo on gtyarnprojo.gtyarnprojoid = gtyarnproreceipt.jobNo
        left join gtprocessmast on gtprocessmast.GTPROCESSMASTID = gtyarnproreceipt.PROCESSNAME   
   WHERE
        gtyarnproreceipt.gtyarnproreceiptid = : ypIsNo
        `, { ypIsNo })

        const po = result1.rows[0]
        const delNonGridDetails = {
            remarks: po[0], supplierDcNo: po[1], dcDate: po[2], recNo: po[3],
            vehicleNo: po[4], supplier: po[5], comName: po[6], receiptId: po[7], ypIsNo: po[8], processName: po[9]
        }
        console.log(delNonGridDetails, 'delNonGridDetails');
        const ConsumptionDet = await connection.execute(`
        select
        gtyarnproreceiptstock.gtyarnproreceiptstockid,
        gtyarnproreceiptstock.gtyarnproreceiptid,
        gtyarnmaster.yarn,
        gtcolormast.colorName,
        gtunitMast.unitName,
        gtyarnproreceiptstock.TAXRATE1,
        gtyarnproreceiptstock.issQty1,
        gtyarnproreceiptstock.lossQty,
        gtyarnproreceiptstock.issRecQty,
        gtyarnproreceiptstock.LOTNO,
        gtyarnproreceiptstock.issno1,
        gtyarnproreceipt.YPISNO
        from 
        gtyarnproreceiptstock 
 LEFT JOIN 
        gtcolormast on gtcolormast.gtcolormastid = gtyarnproreceiptstock.COLOR1       
 left join 
        gtyarnmaster on gtyarnmaster.gtyarnmasterid = gtyarnproreceiptstock.ALIASNAME1
 left join 
        gtunitMast on gtunitMast.gtunitMastid = gtyarnproreceiptstock.uom1 
 left join gtyarnproreceipt on gtyarnproreceiptstock.gtyarnproreceiptid = gtyarnproreceipt.GTYARNPRORECEIPTID 
 where
 gtyarnproreceipt.gtyarnproreceiptid = : ypIsNo
 `, { ypIsNo })
        const stock = ConsumptionDet.rows.map(stc => ({
            stockId: stc[0], receiptId: stc[1], yarnName: stc[2], color: stc[3], uom: stc[4], tax: stc[5], issQty: stc[6], lossQty: stc[7], issRecQty: stc[8], lotNo: stc[9], issueNo: stc[10]
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

    const { vehicleNo, remarks, supplierDcDate, supplierDcNo, delNo, deliveryDetails, consDetails, recNo, userName } = req.body;
    const connection = await getConnection(res);
    try {
        if (!delNo || !deliveryDetails || !consDetails) {
            return res.json({ statusCode: 1, message: 'Required Fields: ypIsNo , deliveryDetails' });
        }
        if (deliveryDetails && consDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Delivery Details Cannot be Empty' });
        }

        const TOTALQTY = deliveryDetails.reduce((a, c) => a + parseFloat(c.delQty), 0);

        const nonGridSql = `
            UPDATE gtYarnProReceipt
            SET vehicleNo = '${vehicleNo}',
                remarks = '${remarks}',
                PARTYDCDATE = TO_DATE('${supplierDcDate}', 'DD-MM-YYYY'),
                PARTYDCNO = '${supplierDcNo}',
                modified_by='${userName}',
                USERID='${userName}',
                modified_on=   TO_TIMESTAMP('${moment(date).format("YYYY-MM-DD HH:mm:ss")}', 'YYYY-MM-DD HH24:MI:SS.FF')
                    WHERE gtYarnProReceiptid= '${delNo}'
        `;

        console.log(nonGridSql, 'nonsql');
        const nonGridResult = await connection.execute(nonGridSql);
        const lastRowData = await connection.execute(`
        select GTYARNPRORECEIPTID,ypisdate,ypisno from gtYarnProReceipt where rowid = '${nonGridResult.lastRowid}'
        `)
        console.log(lastRowData, 'lastRowData');
        const [GTYARNPRORECEIPTID, YPISDATE, YPISNO] = lastRowData.rows[0]

        let oldDeliveryDetailsItems = await connection.execute(`SELECT gtyarnproreceiptdetid from gtYarnProReceiptdet
        WHERE GTYARNPRORECEIPTID = ${GTYARNPRORECEIPTID}`)
        oldDeliveryDetailsItems = oldDeliveryDetailsItems.rows.map(item => item[0])

        const newUpdateDeliveryItemsIds = deliveryDetails.filter(item => item?.gtyarnproreceiptdetid).map(item => item?.gtyarnproreceiptdetid)

        const removedItems = getRemovedItems(oldDeliveryDetailsItems, newUpdateDeliveryItemsIds);

        if (removedItems.length > 0) {
            await connection.execute(`DELETE FROM gtyarnproreceiptdet WHERE gtyarnproreceiptdetid IN (${removedItems}) `)
        }
        await deleteYarnStock(connection, delNo)
        await (async function updateGridDetails() {
            const promises = deliveryDetails.map(async (deliveryItem) => {
                const alreadyGrnResult = await connection.execute(`
                select COALESCE(sum(totalrecqty),0 ) 
                from gtyarnproreceiptdet 
                    where   
                    gtyarnprojodetid
                     = ${deliveryItem.
                        gtyarnprojodetid
                    } and GTYARNPRORECEIPTID < ${GTYARNPRORECEIPTID}
                    `)
                const [TOTALRECQTY] = alreadyGrnResult.rows[0]
                const gridsql = `
                select 
                aliasname,
               det.color,
                uom,
               det.processname,
                proamount,
                tax,
                orderno,
                jobQty,
                po.gtyarnprojoid,
                po.docdate,
                gtYarnMaster.yarnname,
                gtunitmast.unitname,
                gtcolormast.colorname,
                gtbuyermast.buyercode,
                gtprocessmast.PROCESSNAME,
                fy.finyr,
                jobRate
            from gtyarnprojodet det
            join gtyarnprojo po on det.gtyarnprojoid = po.gtyarnprojoid
            LEFT JOIN gtfinancialYear fy on fy.gtfinancialYearid = po.finYear
            join gtYarnMaster on gtYarnMaster.GTYARNMASTERID = det.aliasname
            join gtunitmast on gtunitmast.GTUNITMASTID = det.uom
            join gtcolormast on gtcolormast.GTCOLORMASTID = det.COLOR
            join gtbuyermast on gtbuyermast.buyerCode = det.buyercode
            join gtprocessmast on gtprocessmast.gtprocessmastid = det.PROCESSNAME          
                         where gtyarnprojodetid =${deliveryItem.gtyarnprojodetid}
                `; console.log(gridsql, 'gridsql');
                const gtYarnPoDetResult = await connection.execute(gridsql)
                const [yarnname, color, uom, processname, proamount, tax, orderNo, jobQty, gtyarnprojoid, jobDate, yarnAliasName, unitName, colorName, buyerCode, proName, finYearCode, jobRate] = gtYarnPoDetResult.rows[0]
                const taxRate = jobRate + (jobRate / 100 * tax)
                const balQty = parseFloat(jobQty) - parseFloat(TOTALRECQTY)
                const totalRecQty = parseFloat(deliveryItem.totalrecQty);
                console.log(deliveryItem.totalrecQty, 'recqty');
                let grnQty = totalRecQty;
                let excessQty = 0;
                if (grnQty > balQty) {
                    grnQty = balQty
                    excessQty = totalRecQty - balQty
                }
                const stockSql = `INSERT INTO gtyarnstockmast (GTYARNSTOCKMASTID, TAXRMRATE, RMRATE, PROJECTID, IS_CANCELLED, 
                    STOCKQTY, EXCESSQTY,COMPNAME, LOTNO, 
                    FINYEAR,COMPCODE, DOCID, DOCDATE, PLUSORMINUS, TRANSTYPE, ORDERNO, 
                    YARNNAME, COLOR, UOM, QTY, 
                    RATE, TAXRATE,AMOUNT,TAXAMT,
                    LOCID,STOREDID,PROCESSNAME,TOTALRATE,TAXTOTALRATE,ORDERTRANSTYPE, STOCKTYPE,BUYCODE,USERID, modified_By, modified_on, versionId) 
                    VALUES(supplierseq.nextVal, 0, 0, '${PROJECTID}', 'F', 
                    '${totalRecQty}', '${excessQty}', '${COMPNAME}', '${deliveryItem.lotNo}', 
                    '${finYearCode}', '${COMPSHORTCODE}','${YPISNO}', '${(YPISDATE ? moment(YPISDATE).format("DD-MM-YYYY") : '')}', 'P', '${YARN_PROCESS_RECEIPT_PTRANSACTION}','${orderNo}', 
                    '${yarnAliasName}', '${colorName}', '${unitName}', '${totalRecQty}', '${jobRate}', '${taxRate}' , '${jobRate * totalRecQty}',
                    '${totalRecQty * grnQty}', 
                    '${LOCID}', '${YARN_STORE_NAME}','${proName}', '${jobRate}', '${taxRate}', '${TRANSTYPE}', '${REC_STOCK_TYPE}','${buyerCode}','${userName}','${userName}', TO_TIMESTAMP('${moment(date).format("YYYY-MM-DD HH:mm:ss")}', 'YYYY-MM-DD HH24:MI:SS.FF'), '${GTYARNPRORECEIPTID}')`;
                console.log(stockSql, 'stocksql');
                await connection.execute(stockSql);
                if (deliveryItem?.gtyarnproreceiptdetid) {
                    const gridSql = `
                                UPDATE gtYarnProreceiptdet
                                SET totalRecQty = '${totalRecQty}',
                                recQty = '${deliveryItem.recQty}',
                                lotNo1 = '${deliveryItem.lotNo}' 
                                WHERE gtyarnproreceiptdetid = '${deliveryItem?.gtyarnproreceiptdetid}'
                            `;
                    console.log(gridSql, 'u grid sql');
                    await connection.execute(gridSql)
                } else {
                    const convertedPoDate = moment(jobDate).format("DD-MM-YYYY")
                    const gridSql = `
                INSERT INTO gtYarnProReceiptdet (gtyarnproreceiptdetid,GTYARNPRORECEIPTID,YARNPROCESS,BUYERCODE, YARNNAME, COLORNAME, JOBNO, 
                    UOM,AGRNQTY, TAXRATE,   gtyarnprojodetid, ORDERNO, GRNQTY, 
                    BALQTY, POPRICE, POQTY, GRNBAGS, TOTALGRNQTY, LOTNO, POBAGS, POTYPE, PODATE, TRANSTYPE, EXCESSQTY)
                    VALUES(supplierseq.nextVal, ${GTYARNPRORECEIPTID},'${processname}','${buyercode}', '${yarnname}', '${color}', '${gtyarnprojoid}', 
                    '${uom}', ${TOTALRECQTY}, ${taxRate}, '${deliveryItem.gtyarnprojodetid}', '${orderNo}', ${grnQty}, 
                    ${balQty}, ${proamount}, ${jobQty}, ${deliveryItem.delBags}, ${totalRecQty}, '${deliveryItem.lotNo}', ${poBags}, '${POTYPE}', 
                    TO_DATE('${convertedPoDate}', 'DD-MM-YYYY'), '${TRANSTYPE}', ${excessQty}  )
                    `
                    await connection.execute(gridSql)
                    console.log(gridSql, ' gridSql 536');
                }
                const accumulatedGrnQty = parseFloat(TOTALRECQTY ? TOTALRECQTY : 0) + parseFloat(totalRecQty);
                const updatePoDetSql = `
                UPDATE GTYARNPROJODET 
                SET totalRecQty = ${accumulatedGrnQty},
                excessQty = ${excessQty},
                recQty = ${substract(accumulatedGrnQty, excessQty)}
                WHERE   gtyarnprojodetid = ${deliveryItem.gtyarnprojodetid}
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



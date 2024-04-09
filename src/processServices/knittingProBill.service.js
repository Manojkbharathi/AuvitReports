import { getConnection } from "../constants/db.connection.js"
import { getCurrentFinancialYearId } from "../queries/financialYear.js";
import { COMPCODE, PROJECTID, POTYPE, TRANSTYPE, TAXTEMP, GY_BILL_ENTRY_PTRANSACTION } from "../constants/defaultQueryValues.js"
import { getSupplierName } from "../queries/supplier.js";
import { getNextKnittingProInvoiceNo } from "../queries/sequences.js";
import { partyState } from "../queries/supplier.js";
import { getRemovedItems } from "../Helpers/helper.js";

export async function getDocId(req, res) {
    const connection = await getConnection(res)
    const yPoIno = await getNextKnittingProInvoiceNo(connection);
    connection.close()
    return res.json({ statusCode: 0, docId: yPoIno })
}
async function createTaxGridDetails(connection, taxGridDetails, gtknitprobillId) {
    const promises = taxGridDetails.map(async (tax) => {
        const taxCreate = `INSERT INTO gtknitprobilltax
        (GTKNITPROBILLTAXID, gtknitprobillId,NOTES1,
        SF,TAX1,
        REGISTERVALUE,ADVALUE,ADTEMPRND,ADSUGGESTIVE,ADFORMULA,ADID,
        ADORDER, ADPORM,ADNAME,GTKNITPROBILLTAXROW)
        VALUES (supplierseq.nextVal,'${gtknitprobillId}', '${tax.notes}',
        '${tax.sf}', '${tax.numId}', 
        '${tax.adId === "RND" ? 0 : 1}', '${tax.adValue}', '${tax.adValue}', '${tax.adSuggestive}', '${tax.adFormula}', '${tax.adId}',
        0, '${tax.adPorm}','${tax.adType}', '${tax.gtAdddedDetailRow}' )`
        console.log(taxCreate)
        return await connection.execute(taxCreate)
    })
    return Promise.all(promises)
}
async function deleteTaxGridDetails(connection, gtknitprobillId) {
    return await connection.execute(`DELETE FROM gtknitprobilltax WHERE  gtknitprobillId=${gtknitprobillId}`)
}

async function getTaxGridDetails(connection, gtknitprobillId) {
    const sql = `select sf, notes1, adname, adformula, adid, adporm, adsuggestive,GTKNITPROBILLTAXROW, advalue,TAX1 FROM gtknitprobilltax where gtknitprobillId = ${gtknitprobillId}`
    let result = await connection.execute(sql);
    result = result.rows.map(i => ({ sf: i[0], notes: i[1], adType: i[2], adFormula: i[3], adId: i[4], adPorm: i[5], adSuggestive: i[6], gtAdddedDetailRow: i[7], adValue: i[8], numId: i[9] }))
    return result
}

export async function create(req, res) {
    const connection = await getConnection(res)
    const { supplierId: gtCompMastId, remarks: REMARKS, netAmount: NETAMT, netBillValue: NETBILLVALUE, partyBillNo, partyBillDate: PARTYBILLDATE, invoiceDetails, taxGridDetails, docNo } = req.body;
    console.log(docNo, 'job');
    try {
        if (!gtCompMastId || !invoiceDetails || !taxGridDetails) {
            return res.json({ statusCode: 1, message: 'Required Fields: supplierId, invoiceDetails, taxGridDetails' });
        }
        if (invoiceDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Invoice Details Cannot be Empty' });
        }
        if (taxGridDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Tax Details Cannot be Empty' });
        }
        const FINYR = await getCurrentFinancialYearId(connection);
        const SUPPLIER = await getSupplierName(connection, gtCompMastId);
        const TOTALQTY = invoiceDetails.reduce((a, c) => a + parseFloat(c.billQty), 0);
        const GROSSAMT = invoiceDetails.reduce((a, c) => a + parseFloat(c.billQty * c.billRate), 0);
        const DOCID = await getNextKnittingProInvoiceNo(connection)
        const PARTYSTATE = await partyState(connection, gtCompMastId)
        const sqlData = `
        select det.pre
        from gtKnitjo det
            WHERE det.gtKnitjoId = :docNo
      `; console.log(sqlData, 'sqlData');
        const jobDetails = await connection.execute(sqlData, { docNo: docNo });

        if (!jobDetails) return res.json({ statusCode: 1, message: 'Job Not Found' });
        const [pre] = jobDetails.rows[0];
        const nonGridSql =
            `INSERT INTO gtknitprobill( gtknitprobillId,TAXTEMP,FINYEAR,COMPCODE,NETAMOUNT,REMARKS,GROSSAMOUNT,TOTALQTY,NETBILLVALUE,
                PARTYBILLDATE,PARTYBILLNO,PARTYSTATE,SUPPLIER,KPBILLDATE,kpBillNo,PROJECTID,pre)
            VALUES ( supplierseq.nextVal,'${TAXTEMP}','${FINYR}','${COMPCODE}','${NETBILLVALUE}','${REMARKS}','${GROSSAMT}','${TOTALQTY}','${NETBILLVALUE}',
            TO_DATE('${PARTYBILLDATE}', 'DD/MM/YY'),'${partyBillNo}','${PARTYSTATE}','${SUPPLIER}', TO_DATE(CURRENT_DATE, 'DD/MM/YY'),'${DOCID}','${PROJECTID}','${pre}')`
        console.log(nonGridSql, 'non');
        const nonGridResult = await connection.execute(nonGridSql)
        const lastRowData = await connection.execute(`
        select  gtknitprobillId from gtknitprobill where rowid = '${nonGridResult.lastRowid}'
        `)
        const gtknitprobillId = lastRowData.rows[0][0]
        await createTaxGridDetails(connection, taxGridDetails, gtknitprobillId)
        await (async function createGridDetails() {
            const promises = invoiceDetails.map(async (billItem) => {
                let aGrnSql = `
                select sum(totalRecQty) as alreadyGrnQty from gtFabRecToKnitDet 
                where gtknitjodetid = ${billItem.gtKnitJoDetid

                    }
                `
                console.log(aGrnSql, 'aGrnSql');
                const alreadyGrnResult = await connection.execute(aGrnSql)
                const [aGrnQty] = alreadyGrnResult.rows[0]
                console.log(aGrnQty, 'agrn');
                let aBillQtySql = `
                select sum(billQty) from gtknitprobilldet 
                where DETAILID = ${billItem.gtKnitJoDetid

                    }
                `
                const alreadyBillQtyResult = await connection.execute(aBillQtySql)
                const aBillQty = alreadyBillQtyResult.rows[0][0] ? alreadyBillQtyResult.rows[0][0] : 0

                const balQty = parseFloat(aGrnQty) - parseFloat(billItem.billQty)

                const billAmount = billItem.billQty * billItem.billRate
                const discAmount = billItem.discountType === "Per" ? (billItem.discountValue / 100) * billAmount : billItem.discountValue;
                const amount = billAmount - discAmount;


                let gtYarnPoDetResult = await connection.execute(`
                select det.aliasname, det.color, det.uom, det.processname1, jobPrice, det.jobQty, po.gtKnitJoId, gtnorderentry.gtnorderentryid,gtbuyermast.gtbuyermastid,
fDia,Kdia
,GSM,GG,LL,FABRICTYPE,DESIGN
                from gtKnitJoDet det
                join gtKnitJo po on det.gtKnitJoId = po.gtKnitJoId
                join gtnorderentry on gtnorderentry.orderno = det.orderno1
             left   join gtbuyermast on gtbuyermast.buyercode = det.buyercode1
                where det.gtKnitJoDetId = ${billItem.gtKnitJoDetid

                    }
                `)
                const [yarnname, color, uom, processname, poRate, jobQty, gtKnitJoId, orderid, buyercode, fDia, kDia, gsm, gg, ll, fabType, design] =
                    gtYarnPoDetResult.rows[0]

                const gridSql = `
                INSERT INTO gtknitprobilldet (gtknitprobilldetId,  gtknitprobillId,UOM,COLOR, PROCESSNAME, FABRIC,ORDERNO,JOBNO,        
                    DISCAMT,AMOUNT,DVAL,DISCTYPE,DETAILID,NOTES,
                    TAX,BILLAMT, BILLRATE,BILLQTY,BALQTY,ABILLQTY,
                    JOBRATE,RECQTY, JOBQTY, TRANSTYPE,FDIA,GSM,DESIGN,FABTYPE,
                    GG,LL,KDIA,ISSQTY)
                    VALUES(supplierseq.nextVal, ${gtknitprobillId},${uom},${color},${processname}, ${yarnname},'${orderid}', '${gtKnitJoId}',
                    ${discAmount}, ${amount}, ${billItem.discountValue}, '${billItem.discountType}', ${billItem.gtKnitJoDetid

                    }, '${billItem.notes}',
                    ${billItem.tax},${billAmount},${billItem.billRate}, ${billItem.billQty}, ${balQty}, ${aBillQty},
                    ${poRate}, ${aGrnQty},${jobQty},  '${TRANSTYPE}' ,  '${fDia}',  '${gsm}',  '${design}',  '${fabType}',    '${gg}',  '${ll}',  '${kDia}',  '${billItem.issQty}')`
                console.log(gridSql, 'gridSql');
                await connection.execute(gridSql)
                const accumulatedBillQty = parseFloat(aBillQty ? aBillQty : 0) + parseFloat(billItem.billQty);
                const updatePoBillSql = `
                UPDATE gtKnitJoDet 
                SET billQty = ${accumulatedBillQty}
                WHERE gtKnitJoDetId = ${billItem.gtKnitJoDetid

                    }
                `
                await connection.execute(updatePoBillSql)
            })
            return Promise.all(promises)
        })()
        await getNextKnittingProInvoiceNo(connection)
        connection.commit()
        return res.json({ statusCode: 0, data: gtknitprobillId })
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

    try {
        const { gtCompMastId } = req.query
        const result = await connection.execute(`
        SELECT 
        gtknitprobill.KPBILLNO,
        gtknitprobill.KPBILLDATE,
        gtknitprobill.supplier,
        gtknitprobill.remarks,
        gtknitprobill.partybilldate,
        gtknitprobill.partybillno,
        gtknitprobill.grossamount,
        gtknitprobill.netbillvalue,
        comName.COMPNAME
 FROM   gtknitprobill
 JOIN   gtCompMast suppName ON suppName.compName1 = gtknitprobill.supplier
 LEFT JOIN  gtCompMast comName ON comName.GTCOMPMASTID = gtknitprobill.COMPCODE
  WHERE  suppName.gtCompMastId = :gtCompMastId 
 `, { gtCompMastId })
        const resp = result.rows.map(billEntry => (
            {
                docId: billEntry[0], docDate: billEntry[1], compName: billEntry[2], remarks: billEntry[3],
                partyBillNo: billEntry[5], partyBillDate: billEntry[4], grossAmount: billEntry[6], netBillValue: billEntry[7], comName: billEntry[8]
            }))
        console.log(resp, 'resp');
        return res.json({ statusCode: 0, data: resp })
    }
    catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}


export async function getInvoiceDetails(req, res) {
    const connection = await getConnection(res)

    try {
        const { billNo } = req.query
        console.log(billNo, 'bill209');
        const gridSql = `
        SELECT
        gtfabricMast.FABRIC,
        gtColorMast.colorName,
        gtknitprobilldet.billqty,
        gtknitprobilldet.billRate,
        gtknitprobilldet.tax,
        gtknitprobilldet.jobRate,
        gtknitprobilldet.balQty,
        gtknitprobilldet.jobQty,
    (select sum(billqty)
    from gtknitprobilldet sub
    where sub.detailid = gtknitprobilldet.detailid
    and sub.gtknitprobilldetId < gtknitprobilldet.gtknitprobilldetId) as totalbillQty,
        gtknitprobilldet.gtknitprobilldetId,
        gtKnitJodet.gtKnitJodetId,
        gtKnitJo.docid,
        gtknitprobilldet.recQty,
        gtknitprobilldet.notes,
        gtknitprobilldet.dval,
        gtknitprobilldet.discType,
        gtknitprobilldet.discAmt,
        gtknitprobilldet.amount,
        gtunitmast.unitName
        FROM
        gtknitprobilldet
   LEFT JOIN
        gtfabricMast ON gtfabricMast.gtfabricMastId = gtknitprobilldet.fabric
   LEFT  JOIN
        gtColorMast ON gtColorMast.gtColorMastId = gtknitprobilldet.COLOR
   LEFT JOIN
        gtKnitJodet ON gtKnitJodet.gtKnitJoDetId = gtknitprobilldet.DETAILID
   LEFT JOIN
    gtknitprobill ON gtknitprobill. gtknitprobillId = gtknitprobilldet. gtknitprobillId
  LEFT JOIN
        gtKnitJo ON gtKnitJo.gtKnitJoId = gtKnitJodet.gtKnitJoId
    LEFT JOIN 
        gtunitmast ON gtunitmast.gtunitmastid =  gtKnitJodet.uom
WHERE
gtknitprobill.KPBILLNO = '${billNo}' `
        console.log(gridSql, 'grid');
        const result = await connection.execute(gridSql)

        const resp = result.rows.map(del => ({
            fabric: del[0], color: del[1], billQty: del[2], billRate: del[3], tax: del[4],
            jobPrice: del[5], balQty: del[6], jobQty: del[7],
            totalBillQty: del[8], gtknitprobilldetId: del[9], gtKnitJoDetid

                : del[10], jobNo: del[11],
            totalGrnQty: del[12], notes: del[13], discountValue: del[14], discountType: del[15], discAmount: del[16], processAmount: del[17], uom: del[18]
        }))

        const result1 = await connection.execute(`
        SELECT 
        gtknitprobill.KPBILLNO,
        gtknitprobill.KPBILLDATE,
        gtknitprobill.supplier,
        gtknitprobill.remarks,
        gtknitprobill.partybilldate,
        gtknitprobill.partybillno,
        gtknitprobill.grossamount,
        gtknitprobill.netbillvalue,
        gtknitprobill.gtknitprobillId,
        gtaddded.ADSCHEME,
        comName.COMPNAME
 FROM   gtknitprobill
 JOIN   gtCompMast ON gtCompMast.compName1 = gtknitprobill.supplier
 JOIN gtaddded on gtaddded.GTADDDEDID = gtknitprobill.taxTemp
 LEFT JOIN  gtCompMast comName ON comName.GTCOMPMASTID = gtknitprobill.COMPCODE
    WHERE
        gtknitprobill.KPBILLNO = '${billNo}' `)

        const billEntry = result1.rows[0]
        const delNonGridDetails = {
            docId: billEntry[0], docDate: billEntry[1], supplier: billEntry[2], remarks: billEntry[3],
            partyBillDate: billEntry[4], partyBillNo: billEntry[5], grossAmount: billEntry[6], netBillValue: billEntry[7], gtGrpBillEntryId: billEntry[8], taxTemp: billEntry[9],
            comName: billEntry[10]

        }
        const taxDetails = await getTaxGridDetails(connection, billEntry[8])
        return res.json({ statusCode: 0, data: { ...delNonGridDetails, invoiceDetails: resp, taxDetails } })
    } catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await connection.close()
    }
}
export async function upDate(req, res) {
    const { supplierId: gtCompMastId, remarks: REMARKS, netAmount: NETAMT, netBillValue: NETBILLVALUE, partyBillNo, taxGridDetails,
        partyBillDate, invoiceDetails, billNo } = req.body;
    console.log(partyBillDate, 'req');
    const connection = await getConnection(res);
    try {
        if (!billNo || !invoiceDetails || !taxGridDetails) {
            return res.json({ statusCode: 1, message: 'Required Fields: billNo , invoiceDetails' });
        }
        if (invoiceDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Invoice Details Cannot be Empty' });
        }
        if (taxGridDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Tax Details Cannot be Empty' });
        }
        if (invoiceDetails.length === 0) {
            return res.json({ statusCode: 1, message: 'Invoice Details Cannot be Empty' });
        }
        const TOTALQTY = invoiceDetails.reduce((a, c) => a + parseFloat(c.billQty), 0);
        const GROSSAMT = invoiceDetails.reduce((a, c) => a + parseFloat(c.billQty * c.billRate), 0);
        const nonGridSql = `
            UPDATE gtknitprobill
            SET remarks = '${REMARKS}',
                PARTYBILLDATE = TO_DATE('${partyBillDate}', 'DD-MM-YYYY'),
                PARTYBILLNO = '${partyBillNo}',
                TOTALQTY = '${TOTALQTY}',
                GROSSAMOUNT = '${GROSSAMT}',
                NETAMOUNT = ${NETBILLVALUE},
                NETBILLVALUE = ${NETBILLVALUE}
            WHERE KPBILLNO= '${billNo}'
        `;
        console.log(nonGridSql, 'nongrid');
        const nonGridResult = await connection.execute(nonGridSql);
        const lastRowData = await connection.execute(`
        select  gtknitprobillId from gtknitprobill where rowid = '${nonGridResult.lastRowid}'
        `)
        const gtknitprobillId = lastRowData.rows[0][0]

        let oldDeliveryDetailsItems = await connection.execute(`SELECT gtknitprobilldetId from gtknitprobilldet 
        WHERE  gtknitprobillId = ${gtknitprobillId}`)
        oldDeliveryDetailsItems = oldDeliveryDetailsItems.rows.map(item => item[0])

        const newUpdateDeliveryItemsIds = invoiceDetails.filter(item => item?.gtknitprobilldetId).map(item => item?.gtknitprobilldetId)

        const removedItems = getRemovedItems(oldDeliveryDetailsItems, newUpdateDeliveryItemsIds);

        if (removedItems.length > 0) {
            await connection.execute(`DELETE FROM gtknitprobilldet WHERE gtknitprobilldetId IN (${removedItems}) `)
        }
        await deleteTaxGridDetails(connection, gtknitprobillId);
        await createTaxGridDetails(connection, taxGridDetails, gtknitprobillId);
        await (async function updateGridDetails() {
            const promises = invoiceDetails.map(async (billItem) => {
                let aGrnSql = `
                select sum(totalRecQty) as alreadyGrnQty from gtFabRecToKnitDet 
                where gtKnitJoDetId = ${billItem.gtKnitJoDetid

                    } 
                `
                console.log(aGrnSql, 'aGrnSql');
                const alreadyGrnResult = await connection.execute(aGrnSql)
                const [aGrnQty] = alreadyGrnResult.rows[0]
                let aBillQtySql = `
                select sum(billQty) from gtknitprobilldet 
                where DETAILID = ${billItem.gtKnitJoDetid

                    } and  gtknitprobillId < ${gtknitprobillId}
                `
                const alreadyBillQtyResult = await connection.execute(aBillQtySql)
                const aBillQty = alreadyBillQtyResult.rows[0][0] ? alreadyBillQtyResult.rows[0][0] : 0

                const balQty = parseFloat(aGrnQty) - parseFloat(billItem.billQty)

                const billAmount = billItem.billQty * billItem.billRate
                const discAmount = billItem.discountType === "Per" ? (billItem.discountValue / 100) * billAmount : billItem.discountValue;
                const amount = billAmount - discAmount;
                const gridDet = `
                select det.aliasname, det.color, det.uom, det.processname1, jobPrice, jobQty, po.gtKnitJoId, gtnorderentry.gtnorderentryid
                from gtknitJoDet det
                join gtKnitJo po on det.gtKnitJoId = po.gtKnitJoId
                join gtnorderentry on gtnorderentry.orderno = det.orderno1
                where det.gtKnitJoDetId = ${billItem.gtKnitJoDetid

                    }`
                console.log(gridDet, 'gridDet');
                let gtYarnPoDetResult = await connection.execute(gridDet)
                const [yarnname, color, uom, processname, poRate, jobQty, gtKnitJoId, orderid] =
                    gtYarnPoDetResult.rows[0]
                if (billItem?.gtknitprobilldetId) {
                    const gridSql = `
                    UPDATE gtknitprobilldet
                    SET DISCAMT = ${discAmount},
                    AMOUNT =  ${amount},
                    DVAL = ${billItem.discountValue},
                    DISCTYPE = '${billItem.discountType}',
                    NOTES = '${billItem.notes}',
                    TAX = ${billItem.tax},
                    BILLAMT = ${billAmount},
                    BILLRATE = ${billItem.billRate},
                    BILLQTY = ${billItem.billQty},
                    BALQTY = ${balQty},
                    ABILLQTY = ${aBillQty}
                    WHERE gtknitprobilldetId = '${billItem.gtknitprobilldetId}'
                    `;
                    console.log(gridSql, 'add');
                    await connection.execute(gridSql)
                } else {
                    const gridSql = `
                INSERT INTO gtknitprobilldet (gtknitprobilldetId,  gtknitprobillId,UOM,COLOR, PROCESSNAME, YARNNAME,ORDERNO,PONO,
                    DISCAMT,AMOUNT,DVAL,DISCTYPE,DETAILID,NOTES,
                    TAX,BILLAMT, BILLRATE,BILLQTY,BALQTY,ABILLQTY,
                    PORATE,GRNQTY, POQTY, TRANSTYPE, POTYPE)
                    VALUES(supplierseq.nextVal, ${gtknitprobillId},${uom},${color},${processname}, ${yarnname},'${orderid}', '${gtKnitJoId}',
                    ${discAmount}, ${amount}, ${billItem.discountValue}, '${billItem.discountType}', ${billItem.gtKnitJoDetid

                        }, '${billItem.notes}',
                    ${billItem.tax},${billAmount},${billItem.billRate}, ${billItem.billQty}, ${balQty}, ${aBillQty},
                    ${poRate}, ${aGrnQty}, ${jobQty},  '${TRANSTYPE}', '${POTYPE}')`
                    await connection.execute(gridSql)
                }
                const accumulatedBillQty = parseFloat(aBillQty ? aBillQty : 0) + parseFloat(billItem.billQty);
                const updatePoBillSql = `
                UPDATE gtKnitJoDet 
                SET billQty = ${accumulatedBillQty}
                WHERE gtKnitJoDetId = ${billItem.gtKnitJoDetid

                    }
                `
                console.log(updatePoBillSql, 'updatePoBillSql');
                await connection.execute(updatePoBillSql)
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







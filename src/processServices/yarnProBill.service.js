import { getConnection } from "../constants/db.connection.js"
import { getCurrentFinancialYearId } from "../queries/financialYear.js";
import { COMPCODE, PROJECTID, POTYPE, TRANSTYPE, TAXTEMP, GY_BILL_ENTRY_PTRANSACTION } from "../constants/defaultQueryValues.js"
import { getSupplierName } from "../queries/supplier.js";
import { getNextGreyYarnPoInvoiceNo, getNextYarnProInvoiceNo } from "../queries/sequences.js";
import { partyState } from "../queries/supplier.js";
import { getRemovedItems } from "../Helpers/helper.js";

export async function getDocId(req, res) {
    const connection = await getConnection(res)
    const yPoIno = await getNextGreyYarnPoInvoiceNo(connection);
    connection.close()
    return res.json({ statusCode: 0, docId: yPoIno })
}
async function createTaxGridDetails(connection, taxGridDetails, gtypbillentryId) {
    const promises = taxGridDetails.map(async (tax) => {
        const taxCreate = `INSERT INTO gtypbillentrytaxdet 
        (gtypbillentrytaxdetId, gtypbillentryId,NOTES1,
        SF,TAX1,
        REGISTERVALUE,ADVALUE,ADTEMPRND,ADSUGGESTIVE,ADFORMULA,ADID,
        ADORDER, ADPORM,ADNAME,GTYPBILLENTRYTAXDETROW)
        VALUES (supplierseq.nextVal,'${gtypbillentryId}', '${tax.notes}',
        '${tax.sf}', '${tax.numId}', 
        '${tax.adId === "RND" ? 0 : 1}', '${tax.adValue}', '${tax.adValue}', '${tax.adSuggestive}', '${tax.adFormula}', '${tax.adId}',
        0, '${tax.adPorm}','${tax.adType}', '${tax.gtAdddedDetailRow}' )`
        console.log(taxCreate)
        return await connection.execute(taxCreate)
    })
    return Promise.all(promises)
}
async function deleteTaxGridDetails(connection, gtypbillentryId) {
    return await connection.execute(`DELETE FROM gtypbillentrytaxdet WHERE  gtypbillentryId=${gtypbillentryId}`)
}

async function getTaxGridDetails(connection, gtypbillentryId) {
    const sql = `select sf, notes1, adname, adformula, adid, adporm, adsuggestive,GTYPBILLENTRYTAXDETROW, advalue,TAX1 FROM gtypbillentrytaxdet where gtypbillentryId = ${gtypbillentryId}`
    let result = await connection.execute(sql);
    result = result.rows.map(i => ({ sf: i[0], notes: i[1], adType: i[2], adFormula: i[3], adId: i[4], adPorm: i[5], adSuggestive: i[6], gtAdddedDetailRow: i[7], adValue: i[8], numId: i[9] }))
    return result
}

export async function create(req, res) {
    const connection = await getConnection(res)
    const { supplierId: gtCompMastId, remarks: REMARKS, netAmount: NETAMT, netBillValue: NETBILLVALUE, partyBillNo, partyBillDate: PARTYBILLDATE, invoiceDetails, taxGridDetails, docNo } = req.body;
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
        const DOCID = await getNextYarnProInvoiceNo(connection)
        const PARTYSTATE = await partyState(connection, gtCompMastId)
        const sqlData = `
        select det.pre
        from gtYarnProjo det
            WHERE det.docid = :docNo
      `; console.log(sqlData, 'sqlData');
        const jobDetails = await connection.execute(sqlData, { docNo: docNo });
        console.log(docNo, 'job');
        if (!jobDetails) return res.json({ statusCode: 1, message: 'Job Not Found' });
        const [pre] = jobDetails.rows[0];
        const nonGridSql =
            `INSERT INTO gtypbillentry( gtypbillentryId,TAXTEMP,FINYR,COMPCODE,NETAMT,REMARKS,GROSSAMT,TOTALQTY,NETBILLVALUE,
            PARTYBILLDATE,PARTYBILLNO,PARTYSTATE,SUPPLIER,DOCDATE,DOCID,PROJECTID,pre)
            VALUES ( supplierseq.nextVal,'${TAXTEMP}','${FINYR}','${COMPCODE}','${NETBILLVALUE}','${REMARKS}','${GROSSAMT}','${TOTALQTY}','${NETBILLVALUE}',
            TO_DATE('${PARTYBILLDATE}', 'DD/MM/YY'),'${partyBillNo}','${PARTYSTATE}','${SUPPLIER}', TO_DATE(CURRENT_DATE, 'DD/MM/YY'),'${DOCID}','${PROJECTID}','${pre}')`
        console.log(nonGridSql, 'non');
        const nonGridResult = await connection.execute(nonGridSql)
        const lastRowData = await connection.execute(`
        select  gtypbillentryId from gtypbillentry where rowid = '${nonGridResult.lastRowid}'
        `)
        const gtypbillentryId = lastRowData.rows[0][0]
        await createTaxGridDetails(connection, taxGridDetails, gtypbillentryId)
        await (async function createGridDetails() {
            const promises = invoiceDetails.map(async (billItem) => {
                let aGrnSql = `
                select sum(totalRecQty) as alreadyGrnQty from gtyarnproreceiptdet 
                where detailId = ${billItem.gtyarnprojodetid
                    }
                `
                console.log(aGrnSql, 'aGrnSql');
                const alreadyGrnResult = await connection.execute(aGrnSql)
                const [aGrnQty] = alreadyGrnResult.rows[0]
                console.log(aGrnQty, 'agrn');
                let aBillQtySql = `
                select sum(billQty) from gtypbillentrydet 
                where DETAILID = ${billItem.gtyarnprojodetid
                    }
                `
                const alreadyBillQtyResult = await connection.execute(aBillQtySql)
                const aBillQty = alreadyBillQtyResult.rows[0][0] ? alreadyBillQtyResult.rows[0][0] : 0

                const balQty = parseFloat(aGrnQty) - parseFloat(billItem.billQty)

                const billAmount = billItem.billQty * billItem.billRate
                const discAmount = billItem.discountType === "Per" ? (billItem.discountValue / 100) * billAmount : billItem.discountValue;
                const amount = billAmount - discAmount;


                let gtYarnPoDetResult = await connection.execute(`
                select det.aliasname, det.color, det.uom, det.processname, jobRate, det.jobQty, po.gtYarnProjoid, gtnorderentry.gtnorderentryid,gtbuyermast.gtbuyermastid
                from gtyarnprojodet det
                join gtYarnProjo po on det.gtYarnProjoid = po.gtYarnProjoid
                join gtnorderentry on gtnorderentry.orderno = det.orderno
             left   join gtbuyermast on gtbuyermast.buyercode = det.buyercode
                where det.GTYARNPROJODETID = ${billItem.gtyarnprojodetid
                    }
                `)
                const [yarnname, color, uom, processname, poRate, jobQty, gtYarnProJoId, orderid, buyercode] =
                    gtYarnPoDetResult.rows[0]

                const gridSql = `
                INSERT INTO gtypbillentrydet (gtypbillentrydetId,  gtypbillentryId,UOM,COLOR, PROCESSNAME, YARNNAME,ORDERNO,JOBNO,
                    DISCAMT,AMOUNT,DVAL,DISCTYPE,DETAILID,NOTES,
                    TAX,BILLAMT, BILLRATE,BILLQTY,BALQTY,ABILLQTY,
                    JOBRATE,RECQTY, JOBQTY, TRANSTYPE,BUYERCODE,GREYPROQTY)
                    VALUES(supplierseq.nextVal, ${gtypbillentryId},${uom},${color},${processname}, ${yarnname},'${orderid}', '${gtYarnProJoId}',
                    ${discAmount}, ${amount}, ${billItem.discountValue}, '${billItem.discountType}', ${billItem.gtyarnprojodetid
                    }, '${billItem.notes}',
                    ${billItem.tax},${billAmount},${billItem.billRate}, ${billItem.billQty}, ${balQty}, ${aBillQty},
                    ${poRate}, ${aGrnQty},${jobQty},  '${TRANSTYPE}', '${buyercode}',${aGrnQty} )`
                console.log(gridSql, 'gridSql');
                await connection.execute(gridSql)
                const accumulatedBillQty = parseFloat(aBillQty ? aBillQty : 0) + parseFloat(billItem.billQty);
                const updatePoBillSql = `
                UPDATE GTYARNPROJODET 
                SET billQty = ${accumulatedBillQty}
                WHERE GTYARNPROJODETID = ${billItem.gtyarnprojodetid
                    }
                `
                await connection.execute(updatePoBillSql)
            })
            return Promise.all(promises)
        })()
        await getNextGreyYarnPoInvoiceNo(connection)
        connection.commit()
        return res.json({ statusCode: 0, data: gtypbillentryId })
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
        gtypbillentry.docid,
        gtypbillentry.docdate,
        gtypbillentry.supplier,
        gtypbillentry.remarks,
        gtypbillentry.partybilldate,
        gtypbillentry.partybillno,
        gtypbillentry.grossamt,
        gtypbillentry.netbillvalue,
        comName.COMPNAME
 FROM   gtypbillentry
 JOIN   gtCompMast suppName ON suppName.compName1 = gtypbillentry.supplier
 LEFT JOIN  gtCompMast comName ON comName.GTCOMPMASTID = gtypbillentry.COMPCODE
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
        const gridSql = `
        SELECT
        gtYarnMaster.yarnName,
        gtColorMast.colorName,
        gtypbillentrydet.billqty,
        gtypbillentrydet.billRate,
        gtypbillentrydet.tax,
        gtypbillentrydet.jobRate,
        gtypbillentrydet.balQty,
        gtypbillentrydet.jobQty,
    (select sum(billqty)
    from gtypbillentrydet sub
    where sub.detailid = gtypbillentrydet.detailid
    and sub.GTYPBILLENTRYDETID < gtypbillentrydet.GTYPBILLENTRYDETID) as totalbillQty,
        gtypbillentrydet.gtypbillentrydetId,
        gtYarnProJodet.gtYarnProJodetid,
        gtYarnProJo.docid,
        gtypbillentrydet.recQty,
        gtypbillentrydet.notes,
        gtypbillentrydet.dval,
        gtypbillentrydet.discType,
        gtypbillentrydet.discAmt,
        gtypbillentrydet.amount,
        gtunitmast.unitName
        FROM
        gtypbillentrydet
    JOIN
        gtYarnMaster ON gtYarnMaster.gtYarnMasterId = gtypbillentrydet.YARNNAME
    JOIN
        gtColorMast ON gtColorMast.gtColorMastId = gtypbillentrydet.COLOR
    JOIN
        gtYarnProJodet ON gtYarnProJodet.GTYARNPROJODETID = gtypbillentrydet.DETAILID
    JOIN
    gtypbillentry ON gtypbillentry. gtypbillentryId = gtypbillentrydet. gtypbillentryId
    JOIN
        gtYarnProJo ON gtYarnProJo.gtYarnProJoId = gtYarnProJodet.gtYarnProJoId
    LEFT JOIN 
        gtunitmast ON gtunitmast.gtunitmastid =  gtYarnProJodet.uom
WHERE
gtypbillentry.docid = '${billNo}' `
        console.log(gridSql, 'grid');
        const result = await connection.execute(gridSql)

        const resp = result.rows.map(del => ({
            yarn: del[0], color: del[1], billQty: del[2], billRate: del[3], tax: del[4],
            jobRate: del[5], balQty: del[6], jobQty: del[7],
            totalBillQty: del[8], gtypbillentrydetId: del[9], gtyarnprojodetid
                : del[10], jobNo: del[11],
            totalGrnQty: del[12], notes: del[13], discountValue: del[14], discountType: del[15], discAmount: del[16], processAmount: del[17], uom: del[18]
        }))

        const result1 = await connection.execute(`
        SELECT 
        gtypbillentry.docid,
        gtypbillentry.docdate,
        gtypbillentry.supplier,
        gtypbillentry.remarks,
        gtypbillentry.partybilldate,
        gtypbillentry.partybillno,
        gtypbillentry.grossamt,
        gtypbillentry.netbillvalue,
        gtypbillentry.gtypbillentryid,
        gtaddded.ADSCHEME,
        comName.COMPNAME
 FROM   gtypbillentry
 JOIN   gtCompMast ON gtCompMast.compName1 = gtypbillentry.supplier
 JOIN gtaddded on gtaddded.GTADDDEDID = gtypbillentry.taxTemp
 LEFT JOIN  gtCompMast comName ON comName.GTCOMPMASTID = gtypbillentry.COMPCODE
    WHERE
        gtypbillentry.docid = '${billNo}' `)

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
            UPDATE gtypbillentry
            SET remarks = '${REMARKS}',
                PARTYBILLDATE = TO_DATE('${partyBillDate}', 'DD-MM-YYYY'),
                PARTYBILLNO = '${partyBillNo}',
                TOTALQTY = '${TOTALQTY}',
                GROSSAMT = '${GROSSAMT}',
                NETAMT = ${NETBILLVALUE},
                NETBILLVALUE = ${NETBILLVALUE}
            WHERE docid= '${billNo}'
        `;
        console.log(nonGridSql, 'nongrid');
        const nonGridResult = await connection.execute(nonGridSql);
        const lastRowData = await connection.execute(`
        select  gtypbillentryId from gtypbillentry where rowid = '${nonGridResult.lastRowid}'
        `)
        const gtypbillentryId = lastRowData.rows[0][0]

        let oldDeliveryDetailsItems = await connection.execute(`SELECT gtypbillentrydetId from gtypbillentrydet 
        WHERE  gtypbillentryId = ${gtypbillentryId}`)
        oldDeliveryDetailsItems = oldDeliveryDetailsItems.rows.map(item => item[0])

        const newUpdateDeliveryItemsIds = invoiceDetails.filter(item => item?.gtypbillentrydetId).map(item => item?.gtypbillentrydetId)

        const removedItems = getRemovedItems(oldDeliveryDetailsItems, newUpdateDeliveryItemsIds);

        if (removedItems.length > 0) {
            await connection.execute(`DELETE FROM gtypbillentrydet WHERE gtypbillentrydetId IN (${removedItems}) `)
        }
        await deleteTaxGridDetails(connection, gtypbillentryId);
        await createTaxGridDetails(connection, taxGridDetails, gtypbillentryId);
        await (async function updateGridDetails() {
            const promises = invoiceDetails.map(async (billItem) => {
                let aGrnSql = `
                select sum(totalRecQty) as alreadyGrnQty from gtyarnproreceiptdet 
                where detailId = ${billItem.gtyarnprojodetid
                    } 
                `
                console.log(aGrnSql, 'aGrnSql');
                const alreadyGrnResult = await connection.execute(aGrnSql)
                const [aGrnQty] = alreadyGrnResult.rows[0]
                let aBillQtySql = `
                select sum(billQty) from gtypbillentrydet 
                where DETAILID = ${billItem.gtyarnprojodetid
                    } and  gtypbillentryId < ${gtypbillentryId}
                `
                const alreadyBillQtyResult = await connection.execute(aBillQtySql)
                const aBillQty = alreadyBillQtyResult.rows[0][0] ? alreadyBillQtyResult.rows[0][0] : 0

                const balQty = parseFloat(aGrnQty) - parseFloat(billItem.billQty)

                const billAmount = billItem.billQty * billItem.billRate
                const discAmount = billItem.discountType === "Per" ? (billItem.discountValue / 100) * billAmount : billItem.discountValue;
                const amount = billAmount - discAmount;
                const gridDet = `
                select det.aliasname, det.color, det.uom, det.processname, jobRate, jobQty, po.gtYarnProJoId, gtnorderentry.gtnorderentryid
                from gtYarnProJoDet det
                join gtYarnProJo po on det.gtYarnProJoId = po.gtYarnProJoId
                join gtnorderentry on gtnorderentry.orderno = det.orderno
                where det.GTYARNPROJODETID = ${billItem.gtyarnprojodetid
                    }`
                console.log(gridDet, 'gridDet');
                let gtYarnPoDetResult = await connection.execute(gridDet)
                const [yarnname, color, uom, processname, poRate, jobQty, gtYarnProJoId, orderid] =
                    gtYarnPoDetResult.rows[0]
                if (billItem?.gtypbillentrydetId) {
                    const gridSql = `
                    UPDATE gtypbillentrydet
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
                    WHERE gtypbillentrydetId = '${billItem.gtypbillentrydetId}'
                    `;
                    console.log(gridSql, 'add');
                    await connection.execute(gridSql)
                } else {
                    const gridSql = `
                INSERT INTO gtypbillentrydet (gtypbillentrydetId,  gtypbillentryId,UOM,COLOR, PROCESSNAME, YARNNAME,ORDERNO,PONO,
                    DISCAMT,AMOUNT,DVAL,DISCTYPE,DETAILID,NOTES,
                    TAX,BILLAMT, BILLRATE,BILLQTY,BALQTY,ABILLQTY,
                    PORATE,GRNQTY, POQTY, TRANSTYPE, POTYPE)
                    VALUES(supplierseq.nextVal, ${gtypbillentryId},${uom},${color},${processname}, ${yarnname},'${orderid}', '${gtYarnProJoId}',
                    ${discAmount}, ${amount}, ${billItem.discountValue}, '${billItem.discountType}', ${billItem.gtyarnprojodetid
                        }, '${billItem.notes}',
                    ${billItem.tax},${billAmount},${billItem.billRate}, ${billItem.billQty}, ${balQty}, ${aBillQty},
                    ${poRate}, ${aGrnQty}, ${jobQty},  '${TRANSTYPE}', '${POTYPE}')`
                    await connection.execute(gridSql)
                }
                const accumulatedBillQty = parseFloat(aBillQty ? aBillQty : 0) + parseFloat(billItem.billQty);
                const updatePoBillSql = `
                UPDATE GTYARNPROJODET 
                SET billQty = ${accumulatedBillQty}
                WHERE GTYARNPROJODETID = ${billItem.gtyarnprojodetid
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







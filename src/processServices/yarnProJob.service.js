import { getConnection } from "../constants/db.connection.js";

export async function get(req, res) {
    const connection = await getConnection(res)

    try {
        const { gtCompMastId, searchPoNo, searchPosupplier, searchPoDate, searchPoduedate, isAccepted, billEntryFilter } = req.query;
        let isAccp = isAccepted ? isAccepted.toString() : ''
        const sql = `SELECT  
        gtyarnprojo.docid,
        gtyarnprojo.gtyarnprojoid  AS jobNo,
        gtyarnprojo.docDate,
        gtyarnprojo.supplier,
        gtyarnprojo.grossamount,
        gtprocessmast.processname,
        gtyarnprojo.netamount,
        gtyarnprojo.comname,
        gtyarnprojo.totalqty,
        gtyarnprojo.protype,
            gtyarnMaster.yarnname,
        gtyarnprojodet.gtyarnprojodetid,
        gtyarnprojodet.isAccepted,
        gtunitmast.unitname,
        gtcolormast.colorname,
        gtyarnprojodet.jobQty,
        gtyarnprojodet.jobRate,
gtyarnprojodet.proamount,
        DENSE_RANK() OVER (ORDER BY gtyarnprojo.gtyarnprojoid) AS sno,
        gtcompmast.phoneno,
        gtcompmast.citystate,
        gtcompmast.compname,
        gtcompmast.pincode,
        gtcompmast.panno,
        gtcompmast.gstno,
        gtcompmast.email,
        gtcompmast.address,
        gtcompmast.gtcompmastid
              FROM
        gtyarnprojodet
        LEFT JOIN
        gtyarnprojo ON gtyarnprojo.gtyarnprojoid = gtyarnprojodet.gtyarnprojoid
        LEFT JOIN
        gtcompmast ON gtyarnprojo.supplier = gtcompmast.compname1
        LEFT JOIN
        gtprocessmast ON gtprocessmast.GTPROCESSMASTID = gtyarnprojo.processname1
        LEFT JOIN 
        gtyarnMaster on gtyarnMaster.gtyarnMasterid = gtyarnprojodet.aliasname 
        left Join 
        gtcolormast on gtcolormast.gtcolormastid = gtyarnprojodet.color
        left join 
        gtunitmast on gtunitmast.gtunitmastid = gtyarnprojodet.uom   
        WHERE
        gtcompmast.gtcompmastid = :gtCompMastId
        ${isAccp ?
                `AND gtyarnprojodet.isAccepted = ${isAccp === 'true' ? 1 : 0}` : ""}
                GROUP BY
        gtyarnprojo.docid,
        gtyarnprojo.docDate,
        gtyarnprojo.supplier,
        gtyarnprojo.grossamount,
        gtprocessmast.processname,
        gtyarnprojo.netamount,
        gtyarnprojo.COMNAME,
        gtyarnprojo.totalqty,
        gtyarnprojo.protype,
        gtyarnprojo.gtyarnprojoid,
        gtcompmast.phoneno,
        gtcompmast.citystate,
        gtcompmast.compname,
        gtcompmast.pincode,
        gtcompmast.panno,
        gtcompmast.gstno,
        gtcompmast.email,
        gtcompmast.address,
        gtcompmast.gtcompmastid,
        gtyarnMaster.yarnname,
            gtyarnprojodet.gtyarnprojodetid,
            gtyarnprojodet.isAccepted,
            gtunitmast.unitname,
            gtcolormast.colorname,
                     gtyarnprojodet.jobQty,
        gtyarnprojodet.jobRate,
gtyarnprojodet.proamount
        ORDER BY jobNo
    `
        const result = await connection.execute(sql, { gtCompMastId })
        let resp = result.rows.map(po => ({
            jobONo: po[0], jobNo: po[1], jobDate: po[2], supplier: po[3],
            grossAmount: po[4], processname: po[5], netAmount: po[6], compname: po[7], totalQty: po[8], processType: po[9], yarnName: po[10], gtyarnprojodetid: po[11], isAccepted: po[12], uom: po[13], color: po[14], jobQty: po[15], jobRate: po[16], proAmount: po[17]
        }))
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
export async function acceptPo(req, res) {
    const connection = await getConnection(res)
    try {
        const { gtyarnprojodetid } = req.query
        const response = await connection.execute(`UPDATE gtyarnprojodet a
        SET a.ISACCEPTED = 1
        WHERE a.gtyarnprojodetid = :gtyarnprojodetid`, { gtyarnprojodetid })
        connection.commit()
        if (response.rowsAffected === 1) {
            return res.json({ statusCode: 0, data: "Purchase Order Accepted" });
        } else {
            return res.json({ statusCode: 1, data: "PoNo Does not Exist" });
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


export async function getPoDetails(req, res) {
    const connection = await getConnection(res);

    try {
        const { jobNo } = req.query
        if (!jobNo) {
            return res.status(400).json({ statusCode: 1, error: "jobNo is required" });
        }

        const result = await connection.execute(
            `SELECT
            gtyarnprojo.docId ,
            gtColorMast.colorName,
           gtProcessMast.processName,
            gtyarnprojodet.orderNo,
            gtyarnprojodet.jobQty,
              gtyarnprojodet.amount,
                  gtyarnprojodet.gtyarnprojodetid,
           SUM(gtyarnprojodet.billQty) AS totalBillQty,
           gtyarnProjo.gtYarnProJoId AS jobNo,
           gtyarnProjodet.jobRate 
         FROM  gtyarnprojodet
         JOIN gtColorMast ON gtColorMast.gtColorMastId =  gtyarnprojodet.color
         JOIN gtProcessMast ON gtProcessMast.gtProcessMastId =  gtyarnprojodet.processName
         LEFT JOIN  gtyarnprojo ON  gtyarnprojo.GTYARNPROJOID =  gtyarnprojodet.GTYARNPROJOID
            where  gtyarnprojo.docId = :jobNo
         GROUP BY
            gtyarnprojo.docId,
             gtyarnprojodet.gtyarnprojodetid,
                 gtColorMast.colorName,
               gtProcessMast.processName,
                 gtyarnprojodet.orderNo,
                  gtyarnprojodet.recQty,
                   gtyarnprojodet.jobQty,
                    gtyarnprojodet.amount,
                    gtyarnProjo.gtYarnProJoId,
                         gtyarnProjodet.jobRate 
           `, { jobNo },
        )

        const resp = result.rows.map(det => ({ jobONo: det[0], yarn: det[1], color: det[2], processName: det[3], orderNo: det[4], poBags: det[5], poQty: det[6], bagWeight: det[7], price: det[8], totalAmt: det[9], agrnQty: det[10], agrnBag: det[11], poDetId: det[12], totalBillQty: det[13], joNo: det[14], jobRate: det[15] }))


        return res.json({ statusCode: 0, data: { poDetails: resp, } })
        console.log(data, 'data 180');
    }
    catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}

export async function getPoItem(req, res) {
    const connection = await getConnection(res);

    try {
        const { jobONo } = req.query;
        const sql = `
        SELECT 
        gtyarnprojo.docId,
        gtColorMast.colorName,
        gtProcessMast.processName,
        gtyarnprojodet.planQty,
        gtyarnprojodet.jobQty,
        gtyarnprojodet.issqty,
        gtyarnprojodet.proamount,
        gtyarnprojodet.amount,
        (select sum(TOTALRECQTY) from gtyarnproreceiptdet
where gtyarnproreceiptdet.detailid= gtyarnprojodet.gtyarnprojodetId) AS totalGrnQty,
    (select sum(BILLQTY) from gtypbillentrydet
where gtypbillentrydet.detailid = gtyarnprojodet.gtyarnprojodetId) AS totalBillQty,
        gtyarnprojodet.gtyarnprojodetid,
        gtunitmast.unitName,
        gtyarnprojo.gtyarnprojoid AS jobNo,
        gtyarnProjodet.TOTALRECQTY,
        gtyarnmaster.yarnname,
        gtyarnprojo.supplier,
        gtyarnprojo.comname,
        gtfinancialYear.finyr,
        gtyarnprojodet.jobRate
    FROM 
        gtyarnprojodet
    JOIN 
        gtColorMast ON gtColorMast.gtColorMastId = gtyarnprojodet.color
    JOIN 
        gtProcessMast ON gtProcessMast.gtProcessMastId = gtyarnprojodet.processName
    LEFT JOIN 
        gtyarnprojo ON gtyarnprojo.gtyarnProjoid = gtyarnprojodet.gtyarnProjoid
    LEFT JOIN 
        gtypbillentryDet billDet ON billDet.DETAILID = gtyarnprojodet.gtyarnprojodetid
        LEFT JOIN 
        gtYarnProReceiptdet on gtYarnProReceiptdet.detailId = gtYarnProjoDet.gtYarnProjoDetId
    LEFT JOIN 
       gtunitMast ON gtunitMast.gtUnitMastid = gtyarnprojodet.uom  
    left join 
       gtyarnmaster on gtyarnmaster.gtyarnmasterid =  gtyarnprojodet.aliasname
    LEFT JOIN 
       gtfinancialYear on gtfinancialYear.gtfinancialYearid = gtyarnProJo.finYear
           WHERE 
        gtyarnprojo.docId = :jobONo
    GROUP BY
        gtyarnprojo.docId,
        gtColorMast.colorName,
        gtProcessMast.processName,
        gtyarnprojodet.planQty,
        gtyarnprojodet.jobQty,
        gtyarnprojodet.recQty,
        gtyarnprojodet.issqty,
        gtyarnprojodet.proamount,
        gtyarnprojodet.amount,
        gtyarnprojodet.gtyarnprojodetid,
        gtunitmast.unitName,
        gtyarnprojo.gtyarnprojoid,
        gtyarnProjodet.TOTALRECQTY,
        gtyarnmaster.yarnname,
           gtyarnprojo.supplier,
        gtyarnprojo.comname,
        gtfinancialYear.finyr,
        gtyarnprojodet.jobRate
    `;

        const result = await connection.execute(sql, { jobONo });

        const resp = result.rows.map(det => ({
            jobONo: det[0],
            color: det[1],
            processName: det[2],
            palnQty: det[3],
            jobQty: det[4],
            issQty: det[5],
            processAmount: det[6],
            totalAmt: det[7],
            totalGrnQty: det[8],
            totalBillQty: det[9],
            gtyarnprojodetid: det[10],
            uom: det[11],
            jobNo: det[12],
            totalRecQty: det[13],
            yarn: det[14],
            comName: det[15],
            supplier: det[16],
            finYearCode: det[17],
            jobRate: det[18],
        }));

        const result1 = await connection.execute(`
        SELECT 
        gtunitmast.unitName,
        gtyarnmaster.yarnName,
        gtyarnProIssueStock.ISSBAG,
        gtyarnProIssueStock.issQty1,
        gtyarnProIssue.SUPPDCNO,
        gtyarnProIssue.VEHICLENO,
        gtyarnProIssue.TOTALQTY,
        gtyarnProIssue.REMARKS,
        gtyarnProIssue.comname,
        gtyarnProIssue.ypisno,
        gtyarnProIssue.jobno,
        gtyarnProIssue.gtyarnProIssueId,
        gtColorMast.colorname,
        gtyarnProIssueStock.issQty1,
        gtyarnProIssueStock.gtyarnProIssueid,
        gtprocessmast.processName,
        gtyarnProIssueStock.lotNo,
        gtyarnProIssueStock.lossQty
    FROM 
        gtyarnProIssueStock
    LEFT JOIN 
        gtyarnProIssue ON gtyarnProIssue.gtyarnProIssueid = gtyarnProIssueStock.gtyarnProIssueid
    LEFT JOIN 
        gtyarnProJo ON gtyarnProJo.gtyarnProJoid = gtyarnProIssue.jobno
    left join 
        gtunitmast on gtunitmast.gtunitmastid = gtyarnProIssueStock.uom1
    left join 
        gtyarnmaster on gtyarnmaster.gtyarnmasterid= gtyarnProIssueStock.aliasname1
    LEFT JOIN 
        gtcolorMast on gtcolorMast.gtcolorMastId =  gtyarnProIssueStock.color1
    LEFT JOIN 
        gtprocessmast on gtprocessmast.gtprocessmastid = gtyarnProIssueStock.prevprocess
    WHERE 
    gtyarnprojo.docId = :jobONo 
            `, { jobONo })
        console.log(result1, 'res ');
        const consumptionDet = result1.rows.map(det => ({
            uom: det[0],
            yarnName: det[1],
            issBag: det[2],
            issQty: det[3],
            suppDcNo: det[4],
            vehNo: det[5],
            totalQty: det[6],
            remarks: det[7],
            compName: det[8],
            issueNo: det[9],
            jobNo: det[10],
            issueId: det[11],
            color: det[12],
            issueQty: det[13],
            gtyarnProIssueid: det[14],
            prevProcess: det[15],
            lotNo: det[16],
            lossQty: det[17]
        }))
        const nongrid = await connection.execute(`
        select gtyarnprojoid,
        gtprocessmast.processname,
        gtyarnprojo.supplier,
        gtyarnprojo.docdate,
        gtyarnprojo.comname
         from gtyarnprojo
        left join
         gtprocessmast on  gtprocessmast.gtprocessmastid  = gtyarnprojo.processname1 
         where
         gtyarnprojo.docId = :jobONo 
     `, { jobONo })
        const po = nongrid.rows[0];
        const poNonGridDetails = {
            gtyarnprojoid: po[0],
            processName: po[1], supplier: po[2], docDate: po[3], comName: po[4]
        };

        return res.json({ statusCode: 0, data: { ...poNonGridDetails, data: resp, consumptionDet: consumptionDet }, });
    } catch (err) {
        console.error('Error retrieving data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await connection.close();
    }
}



import { getConnection } from "../constants/db.connection.js";

export async function get(req, res) {
    const connection = await getConnection(res)

    try {
        const { gtCompMastId, searchPoNo, searchPosupplier, searchPoDate, searchPoduedate, isAccepted, billEntryFilter } = req.query;
        let isAccp = isAccepted ? isAccepted.toString() : ''
        const sql = `SELECT  
        GTFABPROJOBORD.fpjno,
        GTFABPROJOBORD.GTFABPROJOBORDID AS jobNo,
        GTFABPROJOBORD.fpjDate,
        GTFABPROJOBORD.supplier,
        gtprocessmast.processname,
        GTFABPROJOBORD.compname,
        GTFABPROJOBORD.totalqty,
        GTFABPROJOBORDDET.GTFABPROJOBORDDETid,
        GTFABPROJOBORDDET.isAccepted,
        gtunitmast.unitname,
        gtcolormast.colorname,
        DENSE_RANK() OVER (ORDER BY GTFABPROJOBORD.GTFABPROJOBORDID) AS sno,
        gtcompmast.phoneno,
        gtcompmast.citystate,
        gtcompmast.compname,
        gtcompmast.pincode,
        gtcompmast.panno,
        gtcompmast.gstno,
        gtcompmast.email,
        gtcompmast.address,
        gtcompmast.gtcompmastid,
        GTFABPROJOBORD.remarks,
        gtfabricMast.fabric,
            GTFABPROJOBORDDET.isAccepted,
        GTFABPROJOBORDDET.jobPrice,
        GTFABPROJOBORDDET.jobQty,
        gtdesignMast.design,
           gtloopMast.ll,
        kdia.dia,
        fDia.dia,
        gtgsmMast.gsm,
              GTFABPROJOBORDDET.proAmt,
                    GTFABPROJOBORD.grAmt,
                          GTFABPROJOBORD.netAmt 
    FROM
        GTFABPROJOBORDDET
        LEFT JOIN
        GTFABPROJOBORD ON GTFABPROJOBORD.GTFABPROJOBORDID = GTFABPROJOBORDDET.GTFABPROJOBORDID
    LEFT JOIN
        gtcompmast ON GTFABPROJOBORD.supplier = gtcompmast.compname1
    LEFT JOIN
        gtprocessmast ON gtprocessmast.GTPROCESSMASTID = GTFABPROJOBORD.processname
    LEFT JOIN 
        gtyarnMaster ON gtyarnMaster.gtyarnMasterid = GTFABPROJOBORDDET.aliasname 
    LEFT JOIN 
        gtcolormast ON gtcolormast.gtcolormastid = GTFABPROJOBORDDET.color
    LEFT JOIN 
        gtunitmast ON gtunitmast.gtunitmastid = GTFABPROJOBORDDET.uom 
    LEFT JOIN 
        gtfabricmast ON gtfabricmast.gtfabricmastid = GTFABPROJOBORDDET.fabric
    LEFT JOIN 
        gtdesignmast ON gtdesignmast.gtdesignmastid = GTFABPROJOBORDDET.design
        left join
        gtdiaMast kdia on  kdia.gtdiaMastid = GTFABPROJOBORDDET.kdia
        left Join 
        gtdiaMast fdia on  fdia.gtdiaMastid = GTFABPROJOBORDDET.kdia
        left join 
        gtloopmast on gtloopmast.gtloopmastid = GTFABPROJOBORDDET.ll
        left join 
        gtggmast on gtggmast.gtggmastid = GTFABPROJOBORDDET.gg
        left join
        gtgsmMast on gtgsmMast.gtgsmMastid = GTFABPROJOBORDDET.gsm  
    WHERE
        gtcompmast.gtcompmastid = :gtCompMastId
            ${isAccp ?
                `AND GTFABPROJOBORDDET.isAccepted = ${isAccp === 'true' ? 1 : 0}` : ""}
                GROUP BY
                GTFABPROJOBORD.fpjno,
                GTFABPROJOBORD.GTFABPROJOBORDID,
                GTFABPROJOBORD.fpjDate,
                GTFABPROJOBORD.supplier,
                gtprocessmast.processname,
                GTFABPROJOBORD.compname,
                GTFABPROJOBORD.totalqty,
                gtyarnMaster.yarnname,
                GTFABPROJOBORDDET.GTFABPROJOBORDDETid,
                GTFABPROJOBORDDET.isAccepted,
                gtunitmast.unitname,
                gtcolormast.colorname,
                gtcompmast.phoneno,
                gtcompmast.citystate,
                gtcompmast.compname,
                gtcompmast.pincode,
                gtcompmast.panno,
                gtcompmast.gstno,
                gtcompmast.email,
                gtcompmast.address,
                gtcompmast.gtcompmastid,
                GTFABPROJOBORD.remarks,
                gtfabricMast.fabric,
                GTFABPROJOBORDDET.GTFABPROJOBORDDETid,
                GTFABPROJOBORDDET.isAccepted,
                GTFABPROJOBORDDET.jobprice,
                GTFABPROJOBORDDET.jobQty,
                gtdesignMast.design,
                kdia.dia,
                fDia.dia,
                gtloopMast.ll,
                gtggmast.gg,
                gtgsmMast.gsm,
                GTFABPROJOBORDDET.proAmt,
                   GTFABPROJOBORD.grAmt,
                          GTFABPROJOBORD.netAmt
                ORDER BY 
                jobNo   
            
    `
        const result = await connection.execute(sql, { gtCompMastId })
        let resp = result.rows.map(po => ({
            jobONo: po[0], jobNo: po[1], jobDate: po[2], supplier: po[3],
            processname: po[4], compname: po[5], totalQty: po[6], gtFabProJobOrdDetId: po[7], isAccepted: po[8], uom: po[9], color: po[10],
            remarks: po[21], fabric: po[22], isAccepted: po[23], jobPrice: po[24], jobQty: po[25], design: po[26], looplength: po[27], kDia: po[28], fDia: po[29], gsm: po[30], proAmt: po[31], grossAmt: po[32], netAmt: po[33]
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
        const { gtFabProJobOrdDetId
        } = req.query
        const response = await connection.execute(`UPDATE GTFABPROJOBORDDET a
        SET a.ISACCEPTED = 1
        WHERE a.gtFabProJobOrdDetId
 = :gtFabProJobOrdDetId
`, {
            gtFabProJobOrdDetId
        })
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
            GTFABPROJOBORD.docId ,
            gtColorMast.colorName,
           gtProcessMast.processName,
            GTFABPROJOBORDDET.orderNo,
            GTFABPROJOBORDDET.jobQty,
              GTFABPROJOBORDDET.amount,
                  GTFABPROJOBORDDET.gtFabProJobOrdDetId
,
           SUM(GTFABPROJOBORDDET.billQty) AS totalBillQty,
           gtyarnProjo.gtYarnProJoId AS jobNo,
           gtyarnProjo.jobRate AS jobRate ,
         FROM  GTFABPROJOBORDDET
         JOIN gtColorMast ON gtColorMast.gtColorMastId =  GTFABPROJOBORDDET.color
         JOIN gtProcessMast ON gtProcessMast.gtProcessMastId =  GTFABPROJOBORDDET.processName
         LEFT JOIN  GTFABPROJOBORD ON  GTFABPROJOBORD.GTYARNPROJOID =  GTFABPROJOBORDDET.GTYARNPROJOID
            where  GTFABPROJOBORD.docId = :jobNo
         GROUP BY
            GTFABPROJOBORD.docId,
             GTFABPROJOBORDDET.gtFabProJobOrdDetId
,
                 gtColorMast.colorName,
               gtProcessMast.processName,
                 GTFABPROJOBORDDET.orderNo,
                  GTFABPROJOBORDDET.recQty,
                   GTFABPROJOBORDDET.jobQty,
                    GTFABPROJOBORDDET.amount,
                    gtyarnProjo.gtYarnProJoId
           `, { jobNo },
        )

        const resp = result.rows.map(det => ({ jobNo: det[0], yarn: det[1], color: det[2], processName: det[3], orderNo: det[4], poBags: det[5], poQty: det[6], bagWeight: det[7], price: det[8], totalAmt: det[9], agrnQty: det[10], agrnBag: det[11], poDetId: det[12], totalBillQty: det[13], joNo: det[14], jobRate: det[15] }))

        const result1 = await connection.execute(`
      SELECT
      DOCID AS PONO,
      DOCDATE,
      SUPPLIER,
      DELTO,
      DUEDATE,
      GROSSAMOUNT,
      NETAMOUNT,
      APPSTATUS,
      TOTALQTY,
      PURTYPE,
       GTCOMPMAST.PHONENO,
      GTCOMPMAST.CITYSTATE,
      GTCOMPMAST.COMPNAME1,
      GTCOMPMAST.PINCODE,
      GTCOMPMAST.PANNO,
      GTCOMPMAST.GSTNO,
      GTCOMPMAST.EMAIL,
      GTCOMPMAST.ADDRESS,
      C.PHONENO,
      C.CITYSTATE,
      C.COMPNAME1 DELTO,
      C.PINCODE,
      C.PANNO,
      C.GSTNO,
      C.EMAIL,
      C.ADDRESS,
      COMP.COMPNAME,
      GTPAYTERMS.PAYTERM,
      CASE WHEN ISACCEPTED = 1 THEN 'true' ELSE 'false' END AS ISACCEPTED,
      DENSE_RANK() OVER (ORDER BY GTYARNPOID) SNO
      FROM
      GTYARNPO
    JOIN
      GTPAYTERMS ON GTPAYTERMS.GTPAYTERMSID = GTYARNPO.PAYTERMS
    JOIN
      GTCOMPMAST ON GTYARNPO.SUPPLIER = GTCOMPMAST.COMPNAME
    JOIN GTCOMPMAST C ON GTYARNPO.DELTO = C.COMPNAME1
    JOIN GTCOMPMAST COMP ON GTYARNPO.COMPCODE = COMP.GTCOMPMASTID
      WHERE
      GTYARNPO.DOCID = :jobNo
     `, { jobNo })
        return res.json({ statusCode: 0, data: { poDetails: resp, } })
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
        const { jobNo } = req.query;
        const sql = `
        SELECT 
        GTFABPROJOBORD.FPJNO,
        gtColorMast.colorName,
        GTFABPROJOBORDDET.processName1,
        GTFABPROJOBORDDET.jobQty,
        GTFABPROJOBORDDET.issqty,
        GTFABPROJOBORDDET.proamt,
        GTFABPROJOBORDDET.amount,
        (select sum(TOTALRECQTY) from GTFABPRORECDTL
        where GTFABPRORECDTL.detailId= GTFABPROJOBORDDET.GTFABPROJOBORDDETID) AS totalGrnQty,
            (select sum(BILLQTY) from gtfabprobillDet
        where gtfabprobillDet.detailid = GTFABPROJOBORDDET.GTFABPROJOBORDDETID) AS totalBillQty,
        GTFABPROJOBORDDET.gtFabProJobOrdDetId,
        gtunitmast.unitName,
        GTFABPROJOBORD.GTFABPROJOBORDID AS jobNo,
        GTFABPROJOBORDDET.TOTALRECQTY,
        GTFABPROJOBORD.supplier,
        GTFABPROJOBORD.compname,
        GTFABPROJOBORDDET.jobPrice,
        gtfabricmast.FABRIC,
        kdia.dia,
        fdia.dia,
        gtloopMast.ll,
        gtggmast.gg,
        gtgsmMast.gsm
    FROM 
        GTFABPROJOBORDDET 
    LEFT JOIN 
        gtColorMast ON gtColorMast.gtColorMastId = GTFABPROJOBORDDET.color
    LEFT JOIN 
        GTFABPROJOBORD ON GTFABPROJOBORD.GTFABPROJOBORDID = GTFABPROJOBORDDET.GTFABPROJOBORDID
    LEFT JOIN 
        gtypbillentryDet billDet ON billDet.DETAILID = GTFABPROJOBORDDET.gtFabProJobOrdDetId
    LEFT JOIN 
        gtunitMast ON gtunitMast.gtUnitMastid = GTFABPROJOBORDDET.uom  
    LEFT JOIN 
        gtfabricmast ON gtfabricmast.gtfabricmastid = GTFABPROJOBORDDET.fabric
        left Join 
        gtdiaMast kdia on  kdia.gtdiaMastid = GTFABPROJOBORDDET.kdia
        left Join 
        gtdiaMast fdia on  fdia.gtdiaMastid = GTFABPROJOBORDDET.fdia
        left join 
        gtloopmast on gtloopmast.gtloopmastid = GTFABPROJOBORDDET.ll
        left join 
        gtggmast on gtggmast.gtggmastid = GTFABPROJOBORDDET.gg
        left join
        gtgsmMast on gtgsmMast.gtgsmMastid = GTFABPROJOBORDDET.gsm
        WHERE 
        GTFABPROJOBORD.GTFABPROJOBORDID = :jobNo
    GROUP BY
        GTFABPROJOBORD.FPJNO,
        gtColorMast.colorName,
        GTFABPROJOBORDDET.processName1,
        GTFABPROJOBORDDET.jobQty,
        GTFABPROJOBORDDET.issqty,
        GTFABPROJOBORDDET.proamt,
        GTFABPROJOBORDDET.amount,
        GTFABPROJOBORDDET.gtFabProJobOrdDetId,
        gtunitmast.unitName,
        GTFABPROJOBORD.GTFABPROJOBORDID,
        GTFABPROJOBORDDET.TOTALRECQTY,
        gtfabricmast.FABRIC,
        GTFABPROJOBORD.supplier,
        GTFABPROJOBORD.compname,
        GTFABPROJOBORDDET.jobPrice,
        kdia.dia,
        fdia.dia,
        gtloopMast.ll,
        gtggmast.gg,
        gtgsmMast.gsm
    `;

        const result = await connection.execute(sql, { jobNo });

        console.log(sql, 'sql');
        const resp = result.rows.map(det => ({
            jobONo: det[0],
            color: det[1],
            processName: det[2],
            jobQty: det[3],
            issQty: det[4],
            processAmount: det[5],
            totalAmt: det[6],
            totalGrnQty: det[7],
            totalBillQty: det[8],
            gtFabProJobOrdDetId: det[9],
            uom: det[10],
            jobNo: det[11],
            totalRecQty: det[12],
            supplier: det[13],
            comName: det[14],
            jobPrice: det[15],
            fabric: det[16],
            kDia: det[17],
            fDia: det[18],
            ll: det[19],
            gg: det[20],
            gsm: det[21]
        }));
        console.log(resp, 'res');

        const consSql = (`
        SELECT 
        gtunitmast.unitName,
        gtFabricmast.fabric,
        gtfabprodelsub.taxRate1,
        gtfabprodelsub.issueroll1,
        gtfabprodelsub.BALQTY2,
        gtfabprodelsub.RECQTY1,
        gtfabprodelsub.RATE,
        gtfabprodel.SUPPDC,
        gtfabprodel.VEHICLENO,
        gtfabprodel.TOTALQTY,
        gtfabprodel.REMARKS,
        gtfabprodel.FROMCOMP,
        gtfabprodel.fpdno,
        gtfabprodel.jobno,
        gtfabprodel.gtfabprodelid,
      gtColorMast.colorname,
      gtfabprodelsub.issueQty1,
      gtfabprodelsub.gtfabprodelsubid,
      gtfabprodelsub.lotNo,
      gtprocessmast.processName,
        kdia.dia,
        fdia.dia,
        gtloopMast.ll,
        gtggmast.gg,
        gtgsmMast.gsm
    FROM 
        gtfabprodelsub
    LEFT JOIN 
        gtfabprodel ON gtfabprodel.gtfabprodelid = gtfabprodelsub.gtfabprodelid
    LEFT JOIN 
        gtyarnProJo ON gtyarnProJo.gtyarnProJoid = gtfabprodel.jobno
    left join 
        gtunitmast on gtunitmast.gtunitmastid = gtfabprodelsub.uom1
    left join 
        gtFabricmast on gtFabricmast.gtFabricmastid= gtfabprodelsub.aliasname1
    LEFT JOIN 
        gtcolorMast on gtcolorMast.gtcolorMastId =  gtfabprodelsub.color1
        left join  gtprocessmast on gtprocessmast.gtprocessmastId = gtfabprodelsub.prevProcessName
    left Join 
        gtdiaMast kdia on  kdia.gtdiaMastid = gtfabprodelsub.kdia1
        left Join
        gtdiaMast fdia on  fdia.gtdiaMastid = gtfabprodelsub.fdia1
        left join 
        gtloopmast on gtloopmast.gtloopmastid = gtfabprodelsub.ll1
        left join 
        gtggmast on gtggmast.gtggmastid = gtfabprodelsub.gg1
        left join
        gtgsmMast on gtgsmMast.gtgsmMastid = gtfabprodelsub.gsm1 
        where
    gtfabprodel.jobNo = :jobNo
            `)
        const result1 = await connection.execute(consSql, { jobNo })
        console.log(result1.rows, 'consSql');

        const consumptionDet = result1.rows.map(det => ({
            uom: det[0],
            fabric: det[1],
            txtRate: det[2],
            issRoll: det[3],
            balQty: det[4],
            recQty: det[5],
            jobRate: det[6],
            suppDcNo: det[7],
            vehNo: det[8],
            totalQty: det[9],
            remarks: det[10],
            compName: det[11],
            issNo: det[12],
            jobNo: det[13],
            issueId: det[14],
            color: det[15],
            issueQty: det[16],
            gtfabprodelsubid: det[17],
            lotNo: det[18],
            prevProcess: det[19],
            kDia: det[20],
            fDia: det[21],
            ll: det[22],
            gg: det[23],
            gsm: det[24],

        }))
        const nongrid = await connection.execute(`
        select
        GTFABPROJOBORDID,
       gtprocessmast.processname,
       GTFABPROJOBORD.supplier,
       GTFABPROJOBORD.FPJDATE,
       GTFABPROJOBORD.compname
        from GTFABPROJOBORD
       left join
        gtprocessmast on  gtprocessmast.gtprocessmastid  = GTFABPROJOBORD.processname 
         WHERE 
         GTFABPROJOBORD.GTFABPROJOBORDID = :jobNo
     `, { jobNo })
        console.log(jobNo, 'rows');
        const po = nongrid.rows[0];
        const poNonGridDetails = {
            gtKnitJoid: po[0],
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



import { getConnection } from "../constants/db.connection.js";

export async function get(req, res) {
    const connection = await getConnection(res)

    try {
        const { gtCompMastId, searchPoNo, searchPosupplier, searchPoDate, searchPoduedate, isAccepted, billEntryFilter } = req.query;
        let isAccp = isAccepted ? isAccepted.toString() : ''

        const bindVar = {
            gtCompMastId,
        }
        const sql = `SELECT
        gtknitjo.docid,
        gtknitjo.gtknitjoid  as jobNo,
        gtknitjo.docDate,
        gtknitjo.supplier,
        gtprocessmast.processname,
        gtknitjo.NETAMOUNT,
        gtknitjo.compname,
        gtknitjo.totalqty,
        gtknitjo.protype,
        DENSE_RANK() OVER (ORDER BY gtknitjo.gtknitjoid) AS sno,
        gtcompmast.phoneno,
        gtcompmast.citystate,
        gtcompmast.compname,
        gtcompmast.pincode,
        gtcompmast.panno,
        gtcompmast.gstno,
        gtcompmast.email,
        gtcompmast.address,
        gtfabricMast.fabric,
        gtunitmast.unitname,
        gtknitjodet.gtknitjodetid,
        gtknitjodet.isAccepted,
        gtknitjodet.joAmt,
        gtknitjodet.jobQty,
        gtdesignMast.design,
        gtloopMast.ll,
        kdia.dia,
        fDia.dia,
        gtknitjodet.gsm,
        gtknitjodet.jobPrice,
        gtcolorMast.colorname
                                      FROM
    gtknitjodet
    LEFT JOIN
        gtknitjo ON gtknitjo.gtknitjoid = gtknitjodet.gtknitjoid
    LEFT JOIN
        gtcompmast ON gtknitjo.supplier = gtcompmast.compname1
    LEFT JOIN
        gtprocessmast ON gtprocessmast.GTPROCESSMASTID = gtknitjo.processname
    LEFT JOIN 
        gtfabricmast on gtfabricmast.gtfabricmastid = gtknitjodet.fabric
            left Join 
            gtcolormast on gtcolormast.gtcolormastid = gtknitjodet.color
            left join 
            gtunitmast on gtunitmast.gtunitmastid = gtknitjodet.uom 
            left join
             gtdesignmast on gtdesignmast.gtdesignmastid =  gtknitjodet.design
             left Join 
             gtdiaMast kdia on  kdia.gtdiaMastid = gtKnitJoDet.kdia
             left Join 
             gtdiaMast fdia on  fdia.gtdiaMastid = gtKnitJoDet.kdia
             left join 
             gtloopmast on gtloopmast.gtloopmastid = gtKnitJoDet.ll
             left join 
             gtggmast on gtggmast.gtggmastid = gtKnitJoDet.gg
             left join
             gtgsmMast on gtgsmMast.gtgsmMastid = gtKnitJoDet.gsm
    WHERE
        gtcompmast.gtcompmastid = :gtCompMastId
        ${isAccp ?
                `AND gtknitjodet.isAccepted = ${isAccp === 'true' ? 1 : 0}` : ""}   
                                     GROUP BY
        gtknitjo.docid,
        gtknitjo.docDate,
        gtknitjo.supplier,
         gtprocessmast.processname,
        gtknitjo.netamount,
        gtknitjo.COMPNAME,
        gtknitjo.totalqty,
        gtknitjo.protype,
        gtknitjo.gtknitjoid,
        gtcompmast.phoneno,
        gtcompmast.citystate,
        gtcompmast.compname,
        gtcompmast.pincode,
        gtcompmast.panno,
        gtcompmast.gstno,
        gtcompmast.email,
        gtcompmast.address,
        gtfabricMast.fabric,
        gtunitmast.unitname,
        gtknitjodet.gtknitjodetid,
         gtknitjodet.isAccepted,
         gtknitjodet.joAmt,
         gtknitjodet.jobQty,
          gtdesignMast.design,
          gtknitjodet.ll,
        gtknitjodet.kdia,
        gtknitjodet.fdia,
        gtknitjodet.gsm,
    kdia.dia,
    fdia.dia,
        gtloopMast.ll,
        gtggmast.gg,
        gtgsmMast.gsm,
        gtknitjodet.jobPrice,
        gtcolorMast.colorname`
        console.log(sql, gtCompMastId, 'sqldat');
        const result = await connection.execute(sql, { ...bindVar })
        let resp = result.rows.map(po => ({
            jobONo: po[0], jobNo: po[1], jobDate: po[2], supplier: po[3],
            processname: po[4], netAmount: po[5], compname: po[6], totalQty: po[7], processType: po[8], fabric: po[18], uom: po[19],
            gtknitjodetid: po[20], isAccepted: po[21], jobAmt: po[22],
            jobQty: po[23], design: po[24], loopLength: po[25],
            kDia: po[26], fDia: po[27], gsm: po[28], jobPrice: po[29], color: po[30],
            from: {
                phoneNo: po[9], city: po[10], compName: po[12], pinCode: po[11], panNo: po[13], gstNo: po[14], email: po[15], address: po[16]
            },
        }))
        console.log(resp, 'res');
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
        const { gtknitjodetid } = req.query
        const response = await connection.execute(`update  gtknitjodet a
      set  a.ISACCEPTED= 1
      where a. gtknitjodetid = : gtknitjodetid`, { gtknitjodetid })
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






export async function getPoItem(req, res) {
    const connection = await getConnection(res);

    try {
        const { jobNo } = req.query;
        const sql = `
        SELECT 
        gtKnitJo.docId,
        gtColorMast.colorName,
        gtProcessMast.processName,
        gtKnitJoDet.jobQty,
        gtKnitJoDet.issqty,
        gtKnitJoDet.amount,
        (select sum(TOTALRECQTY) from gtFabRecToKnitdet
where gtFabRecToKnitdet.gtKnitJoDetId= gtKnitJoDet.gtKnitJoDetId) AS totalGrnQty,
    (select sum(BILLQTY) from gtknitprobilldet
where gtknitprobilldet.detailid = gtKnitJoDet.gtKnitJoDetId) AS totalBillQty,
        gtKnitJoDet.gtKnitJoDetId,
        gtunitmast.unitName,
        gtKnitJo.gtKnitJoid AS jobNo,
        gtKnitjodet.joAmt,
        gtfabricmast.fabric,
        gtKnitJo.supplier,
        gtKnitJo.FromComp,
        gtfinancialYear.finyr,
        gtKnitJoDet.ll,
        gtKnitJoDet.gsm,
        gtKnitJoDet.kdia,
        gtKnitJoDet.gg,
        gtdiamast.dia,
        gtloopMast.ll,
        gtggmast.gg,
        gtgsmMast.gsm,
        gtKnitJoDet.aliasname,
        gtKnitJoDet.JOBPRICE
    FROM 
        gtKnitJoDet
    JOIN 
        gtColorMast ON gtColorMast.gtColorMastId = gtKnitJoDet.color
    JOIN 
        gtProcessMast ON gtProcessMast.gtProcessMastId = gtKnitJoDet.processName1
    LEFT JOIN 
        gtKnitJo ON gtKnitJo.GTKNITJOID = gtKnitJoDet.GTKNITJOID
    LEFT JOIN 
        gtypbillentryDet billDet ON billDet.DETAILID = gtKnitJoDet.GTKNITJODETID
    LEFT JOIN 
       gtunitMast ON gtunitMast.gtUnitMastid = gtKnitJoDet.uom  
    left join 
       gtyarnmaster on gtyarnmaster.gtyarnmasterid =  gtKnitJoDet.aliasname
    LEFT JOIN 
       gtfinancialYear on gtfinancialYear.gtfinancialYearid = gtKnitJo.finYear
       LEFT JOIN 
       gtfabricmast ON gtfabricmast.gtfabricmastid = gtKnitJoDet.aliasname
       left Join 
       gtdiaMast on  gtdiaMast.gtdiaMastid = gtKnitJoDet.kdia
       left join 
       gtloopmast on gtloopmast.gtloopmastid = gtKnitJoDet.ll
       left join 
       gtggmast on gtggmast.gtggmastid = gtKnitJoDet.gg
       left join
       gtgsmMast on gtgsmMast.gtgsmMastid = gtKnitJoDet.gsm
           WHERE 
        gtKnitJo.gtKnitJoid = :jobNo
    GROUP BY
        gtKnitJo.docId,
        gtColorMast.colorName,
        gtProcessMast.processName,
          gtKnitJoDet.jobQty,
        gtKnitJoDet.recQty,
        gtKnitJoDet.issqty,
        gtKnitJoDet.amount,
        gtKnitJoDet.joAmt,
        gtKnitJoDet.gtKnitJoDetid,
        gtunitmast.unitName,
        gtKnitJo.gtKnitJoid,
        gtKnitjodet.TOTALRECQTY,
        gtfabricmast.fabric,
           gtKnitJo.supplier,
        gtKnitJo.FromComp,
        gtfinancialYear.finyr,
        gtKnitJoDet.jobPrice,
        gtKnitJoDet.ll,
        gtKnitJoDet.gsm,
        gtKnitJoDet.kdia,
        gtKnitJoDet.gg,
        gtdiamast.dia,
        gtloopMast.ll,
        gtggmast.gg,
        gtgsmMast.gsm,
        gtKnitJoDet.aliasname,
        gtKnitJoDet.JOBPRICE

    `;
        const result = await connection.execute(sql, { jobNo });
        console.log(result.rows[0], ' sql207');

        const resp = result.rows.map(det => ({
            jobONo: det[0],
            color: det[1],
            processName: det[2],
            jobQty: det[3],
            issQty: det[4],
            Amount: det[5],
            totalGrnQty: det[6],
            totalBillQty: det[7],
            gtKnitJoDetid: det[8],
            uom: det[9],
            jobNo: det[10],
            joAmt: det[11],
            fabric: det[12],
            supplier: det[13],
            comName: det[14],
            finYearCode: det[15],
            llId: det[16],
            gsmId: det[17],
            diaId: det[18],
            ggId: det[19],
            dia: det[20],
            ll: det[21],
            gg: det[22],
            gsm: det[23],
            fabricId: det[24],
            jobPrice: det[25]
        }));

        const result1 = await connection.execute(`
        SELECT 
        gtunitmast.unitName,
        gtYarnDelToKnitStk.stockQty,
        gtYarnDelToKnitStk.KNITISSQTY,
        gtYarnDelToKnitStk.BALQTY2,
        gtYarnDelToKnitStk.issno1,
        gtYarnDelToKnitStk.gtYarnDelToKnitStkid,
        gtColorMast.colorname,
        gtYarnDelToKnitStk.taxRate,
        gtcountsmast.counts,
        gtyarntypemast.yarntype,
        gtcontentmast.yarncontent,
        gtYarnDelToKnitStk.noOfCones,
        gtYarnDelToKnitStk.lotno,
        gtYarnDelToKnitStk.knitissbag,
        gtYarnDelToKnitStk.getRate,
        gtprocessmast.processName,
        gtyarndelToknit.YDTKno,
        gtYarnDelToKnitStk.GTYARNDELTOKNITID
            FROM 
        gtYarnDelToKnitStk
    LEFT JOIN 
        gtYarnDelToKnit ON gtYarnDelToKnit.gtYarnDelToKnitid = gtYarnDelToKnitStk.gtYarnDelToKnitid
    LEFT JOIN 
        gtKnitJo ON gtKnitJo.gtKnitJoid = gtYarnDelToKnit.jobno
    LEFT JOIN 
        gtunitmast ON gtunitmast.gtunitmastid = gtYarnDelToKnitStk.uom1
    LEFT JOIN 
        gtfabricmast ON gtfabricmast.gtfabricmastid = gtYarnDelToKnitStk.aliasnameyarn
    LEFT JOIN 
        gtcolorMast ON gtcolorMast.gtcolorMastId = gtYarnDelToKnitStk.yarncolor
    LEFT JOIN 
        gtyarnMaster on gtyarnMaster.gtyarnmasterid = gtyarndeltoKnitStk.AliasnameYarn
        left join gtcountsmast on gtcountsmast.gtcountsmastid = gtYarnDelToKnitStk.counts
        left join gtyarnTypemast on gtyarnTypemast.gtyarnTypemastid= gtYarnDelToKnitStk.yarnType
        left join gtcontentMast on gtcontentMast.gtcontentMastid= gtYarnDelToKnitStk.yarncontents
        left join gtyarndelToknit on gtyarndelToknit.gtyarndelToknitid= gtyarndeltoknitstk.gtyarndelToknitid
        left join gtcolormast on gtcolormast.gtcolormastid= gtYarnDelToKnitStk.yarnColor
        left join gtprocessmast on gtprocessmast.gtprocessmastid = gtYarnDelToKnitStk.PREVPROCESS 
        where  
    gtyarndeltoknit.jobNo = :jobNo
            `, { jobNo })
        console.log(result1, 'res ');
        const consumptionDet = result1.rows.map(det => ({
            uom: det[0],
            stockQty: det[1],
            issQty: det[2],
            balQty: det[3],
            issNo: det[4],
            gtYarnDelToKnitStkid: det[5],
            color: det[6],
            taxrate: det[7],
            count: det[8],
            yarnType: det[9],
            yarnContent: det[10],
            noOfCones: det[11],
            issLotNo: det[12],
            issBag: det[13],
            getRate: det[14],
            processName: det[15],
            issNo: det[16],
            yarnDelToknitId: det[17]
        }))
        const nongrid = await connection.execute(`
        select
         gtKnitJoid,
        gtprocessmast.processname,
        gtKnitJo.supplier,
        gtKnitJo.docdate,
        gtKnitJo.compname
         from gtKnitJo
        left join
         gtprocessmast on  gtprocessmast.gtprocessmastid  = gtKnitJo.processname 
         WHERE 
        gtKnitJo.gtKnitJoid = :jobNo
     `, { jobNo })

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
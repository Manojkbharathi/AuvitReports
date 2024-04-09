import { getConnection } from "../constants/db.connection.js";


export async function get(req, res) {
    const connection = await getConnection(res)
    try {
        const result = await connection.execute(`
        select docId,
        docDate,
        duedate,
        supplier,
        totalQty,
        ptransaction
         from YFPURREG
     `)
        let resp = result.rows.map(po => ({
            poNo: po[0], poDate: po[1], dueDate: po[2], supplier: po[3], totalQty: po[4], transaction: po[5]
        }))
        console.log(resp, 'ypo nresp');
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






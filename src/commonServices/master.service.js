import { getConnection } from "../constants/db.connection.js";
export async function getKDia(req, res) {

    const connection = await getConnection(res)
    try {
        const result = await connection.execute(`
        select dia,gtdiamastId  from gtDiaMAst 
      `)
        const resp = result.rows.map(d => ({ dia: d[0], diaMastId: d[1] }))

        return res.json({ statusCode: 0, data: resp })

    }
    catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}


export async function getRll(req, res) {

    const connection = await getConnection(res)
    try {
        const result = await connection.execute(`
        select ll,gtloopmastId from gtloopMast      `)
        const resp = result.rows.map(d => ({ ll: d[0], gtloopmastId: d[1] }))

        return res.json({ statusCode: 0, data: resp })

    }
    catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}
export async function getRGg(req, res) {

    const connection = await getConnection(res)
    try {
        const result = await connection.execute(`
        select gg,gtggmastid from gtggmast    `)
        const resp = result.rows.map(d => ({ gg: d[0], gtggmastid: d[1] }))

        return res.json({ statusCode: 0, data: resp })

    }
    catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}
export async function getRGsm(req, res) {

    const connection = await getConnection(res)
    try {
        const result = await connection.execute(`
        select gsm,gtgsmMastId from gtgsmMast`)
        const resp = result.rows.map(d => ({ gsm: d[0], gtGsmmastid: d[1] }))

        return res.json({ statusCode: 0, data: resp })

    }
    catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        await connection.close()
    }
}
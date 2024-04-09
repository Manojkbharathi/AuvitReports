import { COMPCODE } from "../constants/defaultQueryValues.js"

export async function getCompCodeFromId(connection) {
    let compCode = await connection.execute(`
    select compcode from gtcompmast where gtcompmastid = ${COMPCODE}
    `)
    compCode = compCode.rows[0][0]
    return compCode
}
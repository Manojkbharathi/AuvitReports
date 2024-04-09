import { PROJECTID } from "../constants/defaultQueryValues.js"
import { getCompCodeFromId } from "./compCode.js"
import { getCurrentFinancialYearIdAndCode } from "./financialYear.js"

export async function get(connection, lastRowid, tableName) {
    const result = await connection.execute(`
    select * from ${tableName} where rowid = ${lastRowid}
    `)
    if (result.rows.length === 0) return []
    return result.rows[0]
}

export async function updateDocId(connection, viewId, nextVal, viewPhrase) {
    const { finyearCode } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = ` 
    UPDATE AUTOGENERATE A 
    SET A.LASTNO = ${parseInt(nextVal)}
    WHERE A.PROJECTID = '${PROJECTID}' AND A.TX_VIEW_ID = '${viewId}'
    AND A.PREFIX LIKE '%'||'${compCode}'||'%'||'${finyearCode}'||'%${viewPhrase}%'
    `
    await connection.execute(sql)
    connection.commit()
    return
}

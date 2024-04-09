export async function getSupplierName(connection, gtCompMastId) {
    const result = await connection.execute(`
    SELECT COMPNAME FROM GTCOMPMAST WHERE GTCOMPMASTID = ${gtCompMastId} `)
    if (result.rows.length === 0) return ""
    return result.rows[0][0]
}
export async function partyState(connection, gtCompMastId) {
    const result = await connection.execute(`
    select CITYSTATE from gtCompMast WHERE GTCOMPMASTID = ${gtCompMastId} `)
    if (result.rows.length === 0) return ""
    return result.rows[0][0].split("|")[0]
}
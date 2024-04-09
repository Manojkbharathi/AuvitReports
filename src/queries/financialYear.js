
export async function getCurrentFinancialYearId(connection) {
    const result = await connection.execute(`
    SELECT GTFINANCIALYEARID
    FROM gtFinancialYear
    WHERE (startdate <= to_date( CURRENT_DATE , 'DD-MM-YYY')) AND (to_date(CURRENT_DATE,'DD-MM-YYY') <= enddate)
    `)
    if (result.rows.length === 0) return ""
    return result.rows[0][0]
}

export async function getCurrentFinancialYearIdAndCode(connection) {
    let finyear = await connection.execute(`SELECT FINYR, GTFINANCIALYEARID
    FROM gtFinancialYear
    WHERE (startdate <= to_date( CURRENT_DATE , 'DD-MM-YYY')) AND (to_date(CURRENT_DATE,'DD-MM-YYY') <= enddate)`)
    const finyearCode = finyear.rows[0][0];
    const finYearId = finyear.rows[0][1];
    return { finyearCode, finYearId }
}
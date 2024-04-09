export async function deleteYarnStock(connection, docId) {
    return await connection.execute(`
        delete from gtyarnstockmast where docId='${docId}'`)
}

export async function deleteFabricStock(connection, docId) {
    return await connection.execute(`delete from gtfabricstockmast where docId='${docId}'`)
}


export async function deleteAccStock(connection, docId) {
    return await connection.execute(`delete from gtAccStockMast where docId = '${docId}'`)
}
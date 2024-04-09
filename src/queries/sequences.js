import { COMPCODE, DYED_FABRIC_PURCHASE_INWARD_VIEW_ID, GYPI_CODE, DFPI_CODE, DYPI_CODE, ACC_PURCHASE_INWARD_VIEW_ID, API_CODE, DPB_CODE, PROJECTID, YARN_PURCHASE_BILL_ENTRY_VIEW_ID, YARN_PURCHASE_INWARD_VIEW_ID, YPB_CODE, GFPI_CODE, DYEDYARN_PURCHASE_INWARD_VIEW_ID, DYEDYARN_PURCHASE_BILL_ENTRY_VIEW_ID, GREY_FABRIC_PURCHASE_INWARD_VIEW_ID, DYED_FABRIC_PURCHASE_BILL_ENTRY_VIEW_ID, DFPB_CODE, GREY_FABRIC_PURCHASE_BILL_ENTRY, GFPB_CODE, ACC_PURCHASE_BILL_ENTRY_VIEW_ID, APB_CODE, YARN_PROCESS_RECEIPT_VIEW_ID, YREC_CODE, KNITTING_PROCESS_RECEIPT_VIEW_ID, KREC_CODE, DFPR_CODE, FABRIC_PROCESS_RECEIPT_VIEW_ID, YPRB_CODE, YARN_PROCESS_BILL_ENTRY_VIEW_ID, KNITTING_PRO_BILL_ENTRY_VIEW_ID, KPB_CODE, FABRIC_PRO_BILL_ENTRY_VIEW_ID, DFPROB_CODE } from "../constants/defaultQueryValues.js";

import { getCompCodeFromId } from "./compCode.js";
import { getCurrentFinancialYearIdAndCode } from "./financialYear.js";
import { updateDocId } from "./general.js";

export async function getNextGreyYarnPoInwardNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select ypoino 
    from gtyarnpoinward 
    where ttype = 'INWARD' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by ypoino desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, YARN_PURCHASE_INWARD_VIEW_ID, nextVal, GYPI_CODE)
    const newDocId = `${compCode}/${finyearCode}/${GYPI_CODE}-${nextVal}`
    return newDocId
}

export async function getNextDyeddYarnPoInwardNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select ypoino 
    from gtdyarnpoinward 
    where ttype = 'INWARD' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by ypoino desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, DYEDYARN_PURCHASE_INWARD_VIEW_ID, nextVal, DYPI_CODE)
    const newDocId = `${compCode}/${finyearCode}/${DYPI_CODE}-${nextVal}`
    return newDocId
}


export async function getNextGreyYarnPoInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select docid 
    from gtgrpbillentry 
    where compcode = '${COMPCODE}' and FINYR = '${finYearId}' and projectid = '${PROJECTID}'
    order by docid desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, YARN_PURCHASE_BILL_ENTRY_VIEW_ID, nextVal, YPB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${YPB_CODE}-${nextVal}`
    return newDocId
}

export async function getNextDyedYarnPoInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select docid 
    from gtdypbillentry 
    where compcode = '${COMPCODE}' and FINYR = '${finYearId}' and projectid = '${PROJECTID}'
    order by docid desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, DYEDYARN_PURCHASE_BILL_ENTRY_VIEW_ID, nextVal, DPB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${DPB_CODE}-${nextVal}`
    return newDocId
}

export async function getNextDyedFabpurInwardNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select fpino 
    from gtdfabpurinward 
    where ttype = 'INWARD' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by fpino desc) 
    where rownum = 1
    `
    console.log(sql)
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, DYED_FABRIC_PURCHASE_INWARD_VIEW_ID, nextVal, DFPI_CODE)
    const newDocId = `${compCode}/${finyearCode}/${DFPI_CODE}-${nextVal}`
    return newDocId
}

export async function getNextDyedFabpurPoInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select docid 
    from gtdfpbillentry 
    where compcode = '${COMPCODE}' and FINYR = '${finYearId}' and projectid = '${PROJECTID}'
    order by docid desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, DYED_FABRIC_PURCHASE_BILL_ENTRY_VIEW_ID, nextVal, DFPB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${DFPB_CODE}-${nextVal}`
    return newDocId
}

export async function getNextGreyFabPurInwardNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select fpino 
    from gtfabpurinward 
    where ttype = 'INWARD' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by fpino desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, GREY_FABRIC_PURCHASE_INWARD_VIEW_ID, nextVal, GFPI_CODE)
    const newDocId = `${compCode}/${finyearCode}/${GFPI_CODE}-${nextVal}`
    return newDocId
    console.log(result, 'res');
}
export async function getGreyFabricPoInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select docid 
    from gtgfpbillentry 
    where compcode = '${COMPCODE}' and FINYR = '${finYearId}' and projectid = '${PROJECTID}'
    order by docid desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, GREY_FABRIC_PURCHASE_BILL_ENTRY, nextVal, GFPB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${GFPB_CODE}-${nextVal}`
    return newDocId
}
export async function getNextAccPoInwardNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select aGrnNo 
    from gtaccpoinward 
    where ttype = 'INWARD' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by aGrnNo desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, ACC_PURCHASE_INWARD_VIEW_ID, nextVal, API_CODE)
    const newDocId = `${compCode}/${finyearCode}/${API_CODE}-${nextVal}`
    return newDocId
}
export async function getAccessoryPoInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select docid 
    from gtAccpbillentry 
    where compcode = '${COMPCODE}' and FINYR = '${finYearId}' and projectid = '${PROJECTID}'
    order by docid desc) 
    where rownum = 1
    `
    console.log(sql, 'sql');
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, ACC_PURCHASE_BILL_ENTRY_VIEW_ID, nextVal, APB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${APB_CODE}-${nextVal}`
    return newDocId
}
export async function getNextYarnProReceiptNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select ypIsNo 
    from gtYarnProReceipt
    where ttype = 'RECEIPT' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by ypIsNo desc) 
    where rownum = 1
    `
    console.log(sql, 'sql');
    const result = await connection.execute(sql)
    console.log(finYearId, 'fin');
    console.log("Result rows:", result.rows);
    let nextVal;
    if (result.rows.length === 0) {
        console.log("No previous values");
        nextVal = "1".padStart(6, "0");
    } else {
        let prev = result.rows[0][0];
        console.log("Previous value:", prev);
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0");
        console.log("Next value:", nextVal);
    }

    await updateDocId(connection, YARN_PROCESS_RECEIPT_VIEW_ID, nextVal, YREC_CODE)
    const newDocId = `${compCode}/${finyearCode}/${YREC_CODE}-${nextVal}`
    console.log(newDocId, 'doc id');

    return newDocId
}
export async function getNextKnittingProReceiptNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select YDTKNO 
        from gtfabrectoknit
    where ttype = 'RECEIPT' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by YDTKNO desc) 
    where rownum = 1
    `
    console.log(sql, 'sql290');
    const result = await connection.execute(sql)
    console.log(finYearId, 'fin');
    console.log("Result rows:", result.rows);
    let nextVal;
    if (result.rows.length === 0) {
        console.log("No previous values");
        nextVal = "1".padStart(6, "0");
    } else {
        let prev = result.rows[0][0];
        console.log("Previous value:", prev);
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0");
        console.log("Next value:", nextVal);
    }

    await updateDocId(connection, KNITTING_PROCESS_RECEIPT_VIEW_ID, nextVal, KREC_CODE)
    const newDocId = `${compCode}/${finyearCode}/${KREC_CODE}-${nextVal}`
    console.log(newDocId, 'doc id');

    return newDocId
}
export async function getNextFabricProReceiptNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select FPDNO 
        from GTFABPROREC
    where ttype = 'RECEIPT' and compcode = '${COMPCODE}' and finYear = '${finYearId}' and projectid = '${PROJECTID}'
    order by FPDNO desc) 
    where rownum = 1
    `
    console.log(sql, 'sql290');
    const result = await connection.execute(sql)
    console.log(finYearId, 'fin');
    console.log("Result rows:", result.rows);
    let nextVal;
    if (result.rows.length === 0) {
        console.log("No previous values");
        nextVal = "1".padStart(6, "0");
    } else {
        let prev = result.rows[0][0];
        console.log("Previous value:", prev);
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0");
        console.log("Next value:", nextVal);
    }
    await updateDocId(connection, FABRIC_PROCESS_RECEIPT_VIEW_ID, nextVal, DFPR_CODE)
    const newDocId = `${compCode}/${finyearCode}/${DFPR_CODE}-${nextVal}`
    console.log(newDocId, 'doc id');

    return newDocId
}

export async function getNextYarnProInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select docid 
    from  gtypbillentry
    where compcode = '${COMPCODE}' and FINYR = '${finYearId}' and projectid = '${PROJECTID}'
    order by docid desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, YARN_PROCESS_BILL_ENTRY_VIEW_ID, nextVal, YPRB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${YPRB_CODE}-${nextVal}`
    return newDocId
}

export async function getNextKnittingProInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select kpBillNo 
    from  gtknitprobill
    where compcode = '${COMPCODE}' and FINYEAR = '${finYearId}' and projectid = '${PROJECTID}'
    order by kpBillNo desc) 
    where rownum = 1
    `
    console.log(sql, 'sql 378');
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, KNITTING_PRO_BILL_ENTRY_VIEW_ID, nextVal, KPB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${KPB_CODE}-${nextVal}`
    return newDocId
}
export async function getNextFabricProInvoiceNo(connection) {
    const { finyearCode, finYearId } = await getCurrentFinancialYearIdAndCode(connection)
    const compCode = await getCompCodeFromId(connection)
    const sql = `
    select * from 
    (select fpBillNo 
    from   gtfabprobill
    where compcode = '${COMPCODE}' and FINYEAR = '${finYearId}' and projectid = '${PROJECTID}'
    order by fpBillNo desc) 
    where rownum = 1
    `
    const result = await connection.execute(sql)
    let nextVal;
    if (result.rows.length === 0) {
        nextVal = "1".padStart(6, "0")
    } else {
        let prev = result.rows[0][0]
        nextVal = new String(parseInt(prev.split("-")[2]) + 1).padStart(6, "0")
    }
    await updateDocId(connection, FABRIC_PRO_BILL_ENTRY_VIEW_ID, nextVal, DFPROB_CODE)
    const newDocId = `${compCode}/${finyearCode}/${DFPROB_CODE}-${nextVal}`
    console.log(newDocId, 'newDocId');

    return newDocId
}
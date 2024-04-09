export function groupUsers(resp) {
    const output = [];
    resp.forEach(user => {
        let alreadyExistIndex = output.findIndex(item => (item.userName === user.userName) && (item.gtCompMastId === user.gtCompMastId))
        if (alreadyExistIndex === -1) {
            output.push({ userName: user.userName, gtCompMastId: user.gtCompMastId, compName: user.compName, supplyDetails: [user.pCategory] })
        } else {
            output[alreadyExistIndex]["supplyDetails"] = [...(output[alreadyExistIndex]?.supplyDetails ? output[alreadyExistIndex]?.supplyDetails : []), user.pCategory]
        }
    });
    return output
}
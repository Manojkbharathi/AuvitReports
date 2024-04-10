import { getMonthValue } from "./date";

export function pageNumberToReactPaginateIndex(pageNumber) {
  return pageNumber - 1;
}
export function getNumberFromAlphaNumeric(txt) {
  const num = txt.replace(/[^0-9]/g, '');
  return num
}
export function reactPaginateIndexToPageNumber(pageIndex) {
  return pageIndex + 1;
}

export function filterSearch(searchArr, data) {
  const filteredData = data.filter(item => {
    return searchArr.every(searchItem => {
      const { field, searchValue } = searchItem
      if (!item[field] || !searchValue) return true
      if (searchItem?.isDate) {
        return getMonthValue(item[field]).toLowerCase().includes(searchValue.toLowerCase())
      }
      return (item[field].toLowerCase()).includes(searchValue.toLowerCase());

    })
  }


  )
  return filteredData
}

export const discountTypes = [
  { show: "Flat", value: "Flat" },
  { show: "Per", value: "Per" }
]

export function substract(num1, num2) {
  let n1 = parseFloat(num1) * 1000;
  let n2 = parseFloat(num2) * 1000;
  let result = (n1 - n2) / 1000
  return result;
}


export function roundTo2Decimals(n) {
  return Math.round(n * 100) / 100
}

export function getRoundedValueForTax(items) {
  let sum = items.filter(i => i.sf === 1).reduce((a, c) => a + parseFloat(c?.adValue ? c?.adValue : 0), 0)
  return substract(Math.round(sum, 0), roundTo2Decimals(sum))
}

export function getNetAmountForTax(items) {
  let sum = items.filter(i => i.sf === 1).reduce((a, c) => a + parseFloat(c?.adValue ? c?.adValue : 0), 0)
  return roundTo2Decimals(sum)
}
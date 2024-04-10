import moment from "moment";

const getDay = (date) => moment(date).format('DD')

function getMonthName(date) {
    const newDate = new Date(date);
    return newDate.toLocaleString('en-US', { month: 'short' });
}

const getYear = (date) => moment(date).format('YYYY')

export const getMonthValue = (date) => {
    const newDate = new Date(date);
    return `${getDay(newDate)}/${getMonthName(newDate)}/${getYear(newDate)}`
}

export const calculateDaysBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Calculate the difference in milliseconds
    const differenceInMs = end - start;

    // Convert the difference to days
    const days = Math.ceil(differenceInMs / (1000 * 60 * 60 * 24));
    return days
};

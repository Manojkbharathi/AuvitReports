import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BASE_URL, FIN_YEAR } from "../../constants/apiUrl";


const finYear = createApi({
    reducerPath: 'finYear',
    baseQuery: fetchBaseQuery({
        baseUrl: BASE_URL,
    }),
    tagTypes: ['finYear'],
    endpoints: (builder) => ({
        getFinYear: builder.query({
            query: () => {
                return {
                    url: FIN_YEAR,
                    method: 'GET',
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                }
            },
            providesTags: ['finYear'],
        }),

    }),
})

export const {
    useGetFinYearQuery,
} = finYear;

export default finYear;
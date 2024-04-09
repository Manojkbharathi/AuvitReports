import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BASE_URL, PO_REGISTER } from "../../constants/apiUrl";


const dyedYarnPo = createApi({
    reducerPath: 'dyedYarnPo',
    baseQuery: fetchBaseQuery({
        baseUrl: BASE_URL,
    }),
    tagTypes: ['dyedYarnPo'],
    endpoints: (builder) => ({
        getDyedYarnPo: builder.query({
            query: ({ params }) => {
                return {
                    url: PO_REGISTER,
                    method: 'GET',
                    params,
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                }
            },
            providesTags: ['dyedYarnPo'],
        }),
        getdyedYarnPoDeatilsById: builder.query({
            query: (params) => {
                return {
                    url: `${PO_REGISTER}/poDetails`,
                    method: 'GET',
                    params,
                }
            },
            providesTags: ['dyedYarnPo'],
        }),
        getdyedYarnPoItems: builder.query({
            query: (params) => {
                return {
                    url: `${PO_REGISTER}/getPoItem`,
                    method: 'GET',
                    params,
                }
            },
            providesTags: ['dyedYarnPo'],
        }),
        logindyedYarnPo: builder.mutation({
            query: (payload) => ({
                url: PO_REGISTER + "/login",
                method: 'POST',
                body: payload,
                headers: {
                    'Content-type': 'application/json; charset=UTF-8',
                },
            }),
            invalidatesTags: ["dyedYarnPo"],
        }),
        adddyedYarnPo: builder.mutation({
            query: (payload) => ({
                url: PO_REGISTER,
                method: 'POST',
                body: payload,
                headers: {
                    'Content-type': 'application/json; charset=UTF-8',
                },
            }),
            invalidatesTags: ["dyedYarnPo"],
        }),
        updateStatus: builder.mutation({
            query: (params) => {
                return {
                    url: `${PO_REGISTER}/acceptPo`,
                    method: 'PUT',
                    params,
                }
            },
            invalidatesTags: ["dyedYarnPo"],
        }),
        deletedyedYarnPo: builder.mutation({
            query: (id) => ({
                url: `${PO_REGISTER}/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ["dyedYarnPo"],
        }),
    }),
})

export const {
    useGetDyedYarnPoQuery,
    useGetdyedYarnPoDeatilsByIdQuery,
    useGetdyedYarnPoItemsQuery,
    useLogindyedYarnPoMutation,
    useAdddyedYarnPoMutation,
    useUpdateStatusMutation,
    useDeletedyedYarnPoMutation } = dyedYarnPo;

export default dyedYarnPo;
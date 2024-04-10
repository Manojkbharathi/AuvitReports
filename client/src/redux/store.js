import { configureStore } from "@reduxjs/toolkit";
import { openTabs } from "./features";

import { poRegister, finYear } from './service'
import { setupListeners } from '@reduxjs/toolkit/query'




export const store = configureStore({
    reducer: {
        //purchase
        openTabs,
        [poRegister.reducerPath]: poRegister.reducer,
        [finYear.reducerPath]: finYear.reducer



    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            [poRegister.middleware],
            [finYear.middleware]),

});

setupListeners(store.dispatch)
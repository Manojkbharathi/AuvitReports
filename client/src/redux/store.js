import { configureStore } from "@reduxjs/toolkit";
import { openTabs } from "./features";


const commonReducers = {
    openTabs
}
const store = configureStore({
    reducer: {
        ...commonReducers,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }),
});

export default store;
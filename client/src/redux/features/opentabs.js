import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  tabs: [],
};

export const openTabs = createSlice({
  name: "openTabs",
  initialState,
  reducers: {
    push: (state, action) => {
      const existingIndex = state.tabs.findIndex(
        (item) => item.id === action.payload.id
      );
      state.tabs = state.tabs.map((tab) => {
        return { ...tab, active: false };
      });
      if (existingIndex >= 0) {
        state.tabs[existingIndex] = {
          ...state.tabs[existingIndex],
          active: true,
        };
      } else {
        state.tabs.push({ id: action.payload.id, name: action.payload.name, active: true });
      }
      localStorage.setItem("openTabs", JSON.stringify(state.tabs));
    },
    replace: (state, action) => {
      const existingIndex = state.tabs.findIndex(
        (item) => item.name === action.payload.name
      );
      const indexId = state.tabs[existingIndex]["id"]
      state.tabs = state.tabs.map((tab) => {
        return { ...tab, active: false };
      });
      state.tabs.splice(existingIndex, 1, { id: indexId, name: action.payload.replaceName, active: true });
      state.tabs[existingIndex] = {
        ...state.tabs[existingIndex],
        active: true,
      };
      localStorage.setItem("openTabs", JSON.stringify(state.tabs));
    },
    remove: (state, action) => {
      const existingIndex = state.tabs.findIndex(
        (item) => item.id === action.payload.id
      );
      if (state.tabs[existingIndex]?.active) {
        if (state.tabs.length > 1) {
          state.tabs = state.tabs.map((tab) => {
            return { ...tab, active: false };
          });
          if (existingIndex === state.tabs.length - 1) {
            state.tabs[existingIndex - 1] = {
              ...state.tabs[existingIndex - 1],
              active: true,
            };
          } else {
            state.tabs[existingIndex + 1] = {
              ...state.tabs[existingIndex + 1],
              active: true,
            };
          }
        }
      }
      state.tabs = state.tabs.filter(tab => tab.id !== action.payload.id);
      localStorage.setItem("openTabs", JSON.stringify(state.tabs));
    },
  },
});

// Action creators are generated for each case reducer function
export const { push, remove, replace } = openTabs.actions;

export default openTabs.reducer;

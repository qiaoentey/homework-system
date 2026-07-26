export const initialFlowState = {
  screen: "login",
  branchCode: null,
  groupCode: null,
};

export function flowReducer(state, action) {
  switch (action.type) {
    case "LOGIN":
      return { screen: "branch", branchCode: null, groupCode: null };
    case "SELECT_BRANCH":
      return { screen: "group", branchCode: action.branchCode, groupCode: null };
    case "SELECT_GROUP":
      return { ...state, screen: "roster", groupCode: action.groupCode };
    case "BACK_TO_GROUPS":
      return { ...state, screen: "group", groupCode: null };
    case "BACK_TO_BRANCHES":
      return { screen: "branch", branchCode: null, groupCode: null };
    case "LOGOUT":
      return initialFlowState;
    default:
      return state;
  }
}

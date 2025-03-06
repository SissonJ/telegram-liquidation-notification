enum LiquidationType {
  PUBLIC = "PUBLIC_LIQUIDATION",
  PRIVATE = "PRIVATE_LIQUIDATION",
}

type Liquidation = {
  debt_price: string,
  debt_token: string,
  debt_repaid: string,
  collateral_price: string,
  collateral_token: string,
  collateral_liquidated: string,
  collateral_protocol_fee?: string,
  debt_protocol_fee?: string,
}

type Log = {
  id: string,
  time: string,
  type: LiquidationType,
  event:  {
    public_liquidation?: Liquidation,
    private_liquidation?: Liquidation,
  },
}

type PublicLogs = {
  moneyMarketPublicLogs: Log[],
}

type Token = {
  Asset: {
    decimals: number,
  },
  contractAddress?: string,
  symbol: string,
}

type Tokens = {
  tokens: Token[],
}

interface GraphQLResponse<T> {
  data?: T,
  errors?: Array<{
    message: string,
    locations: Array<{
      line: number,
      column: number,
    }>,
    extensions?: {
      code: string,
    },
  }>,
}

export {
 LiquidationType, 
 Liquidation, 
 Log, 
 PublicLogs,
 Tokens,
 GraphQLResponse 
};

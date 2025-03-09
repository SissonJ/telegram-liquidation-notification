import * as fs from 'fs';
import { config } from 'dotenv';
import {
  GraphQLResponse,
  Liquidation,
  PublicLogs, 
  Tokens, 
} from './types';

config();
const QUERY_INTERVAL = 3600000 * 2;


async function main() {
  const notificationsLog = fs.readFileSync('./notifications.txt', 'utf-8');
  const notifications: string[] = JSON.parse(notificationsLog);

  const now = new Date(0);
  now.setUTCMilliseconds(Date.now() - QUERY_INTERVAL);

  const query = `
    query PublicLogs {
      moneyMarketPublicLogs(
        query: {
          where: {
            type: {
              in: [PUBLIC_LIQUIDATION, PRIVATE_LIQUIDATION]
            },
            time: {
              gte: "${now.toISOString()}"
            }
          },
          orderBy: {
            time: "asc"
          }
        }
      ) {
        id
        time
        type
        event
      }
    }
  `;

  const response = await fetch(process.env.GRAPHQL!, {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ query, })
  });

  const responseBody: GraphQLResponse<PublicLogs> = await response.json();
  if (responseBody.errors) {
      console.error("GraphQL Errors:", responseBody.errors);
  }

  if (!responseBody.data?.moneyMarketPublicLogs?.length) {
    return;
  }

  const tokensQuery = `
    query Tokens {
      tokens(query: {}) {
        Asset {
          decimals
        },
        contractAddress
        symbol
      }
    }
  `;

  const tokensResponse = await fetch(process.env.GRAPHQL!, {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ query: tokensQuery, })
  });

  const tokensResponseBody: GraphQLResponse<Tokens> = await tokensResponse.json();
  if (tokensResponseBody.errors) {
      console.error("GraphQL Errors:", tokensResponseBody.errors);
  }

  if (!tokensResponseBody.data?.tokens?.length) {
    return;
  }

  const filteredLogs = responseBody.data.moneyMarketPublicLogs.filter((log) => {
    return !notifications.includes(log.id);
  });

  filteredLogs.forEach(async (log) => {
    let body = "🚨 *Liquidation Alert* 🚨\n\n";
    body += "🕒 *Time*: " + log.time + "\n";

    let event: Liquidation | undefined;
    if(log.type === "PUBLIC_LIQUIDATION") {
      body += "🔒 *Type*: Public Liquidation\n";
      event = log.event?.public_liquidation;
    }
    if(log.type === "PRIVATE_LIQUIDATION") {
      body += "🔒 *Type*: Protocol Liquidation\n";
      event = log.event?.private_liquidation;
    }

    if(event !== undefined) {
      const collateralToken = tokensResponseBody.data!.tokens.find(
        (token) => token.contractAddress === event?.collateral_token
      )!;
      const debtToken = tokensResponseBody.data!.tokens.find(
        (token) => token.contractAddress === event?.debt_token
      )!;
      let collateralAmountUdenom = Number(event.collateral_liquidated); 
      if(event.collateral_sold !== undefined) {
        collateralAmountUdenom = Number(event.collateral_sold);
      }
      const collateralAmount = collateralAmountUdenom/ 10 ** collateralToken.Asset.decimals;
      const debtAmount = Number(event.debt_repaid) / 10 ** debtToken.Asset.decimals;
      const collateralValue = Number(event.collateral_price) * collateralAmount;
      const debtValue = Number(event.debt_price) * debtAmount;

      body += "💰 *Collateral*: $" + collateralValue.toFixed(2) + 
        " " + collateralToken.symbol + "\n";
      body += "💸 *Debt*: $" + debtValue.toFixed(2) + " " + debtToken.symbol + "\n";

      if(event?.collateral_protocol_fee !== undefined) {
        const feeCollateralAmount = Number(event.collateral_protocol_fee) 
          / 10 ** collateralToken.Asset.decimals;
        const feeCollateralValue = Number(event.collateral_price) * feeCollateralAmount;
        body += "🏦 *Protocol Profit*: $" + feeCollateralValue.toFixed(2) 
          + " " + collateralToken.symbol + "\n";
      }
      if(event?.debt_purchased !== undefined) {
        const debtPurchased = Number(event.debt_purchased) / 10 ** debtToken.Asset.decimals;
        const debtPurchasedValue = debtPurchased * Number(event.debt_price);
        const feeDebtValue = (debtPurchasedValue - debtValue) * 0.9;
        body += "🏦 *Protocol Profit*: $" + feeDebtValue.toFixed(2) + " " + debtToken.symbol + "\n";
      }
    }

    if(!notifications.includes(log.id)) {

      notifications.push(log.id);
      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN!}/sendMessage`, 
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              chat_id: process.env.SISSONJ_CHAT_ID,
              text: body,
              parse_mode: "Markdown"
          })
      });

      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN!}/sendMessage`, 
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              chat_id: process.env.SHADE_CHAT_ID,
              text: body,
              parse_mode: "Markdown"
          })
      });
    }
  });

  fs.writeFileSync('./notifications.txt', JSON.stringify(notifications));
}

main().then(() => console.log('Finished!'));

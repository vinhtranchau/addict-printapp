/*
  The custom REST API to support the app frontend.
  Handlers combine application data from qr-codes-db.js with helpers to merge the Shopify GraphQL Admin API data.
  The Shop is the Shop that the current user belongs to. For example, the shop that is using the app.
  This information is retrieved from the Authorization header, which is decoded from the request.
  The authorization header is added by App Bridge in the frontend code.
*/

import { Shopify } from "@shopify/shopify-api";

import {
  asyncForEach,
  array_chunk
} from "../helpers/order-codes.js";
import excelJS from "exceljs"
import fetch from "node-fetch"
import moment from "moment"
import convert from 'xml-js';
import axios from 'axios';

const ORDER_LIST_QUERY = `
  query OrderListData($ordersFirst: Int, $ordersLast: Int, $before: String, $after: String, $sortKey: OrderSortKeys, $reverse: Boolean, $query: String, $savedSearchId: ID) {
    orders(
      first: $ordersFirst
      after: $after
      last: $ordersLast
      before: $before
      sortKey: $sortKey
      reverse: $reverse
      query: $query
      savedSearchId: $savedSearchId
    ) {
      edges {
        cursor
        node {
          id
          name
          createdAt
          processedAt
          note
          displayFinancialStatus
          displayFulfillmentStatus
          lineItems(first: 40) {
            nodes {
              name
              quantity
              variant {
                price
              }
              variantTitle
            }
          }
          shippingAddress {
            firstName
            lastName
            address1
            address2
            city
            company
            phone
          }
          billingAddress {
            firstName
            lastName
            address1
            address2
            phone
            city                         
           }
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
              __typename
            }
            __typename
          }
          fulfillmentOrders(first: 1) {
            edges {
              node {
                id
              }
            }
          }
          currentSubtotalLineItemsQuantity
          tags
          customer {
            id
            email
            firstName
            lastName
            __typename
          }
          __typename
        }
        __typename
      }
      pageInfo {
        hasPreviousPage
        startCursor
        hasNextPage
        endCursor
        __typename
      }
      __typename
    }
  }
`;

const REPORT_LIST_QUERY = `
  query ReportListData($ordersFirst: Int, $ordersLast: Int, $before: String, $after: String, $sortKey: OrderSortKeys, $reverse: Boolean, $query: String, $savedSearchId: ID) {
    orders(
      first: $ordersFirst
      after: $after
      last: $ordersLast
      before: $before
      sortKey: $sortKey
      reverse: $reverse
      query: $query
      savedSearchId: $savedSearchId
    ) {
      edges {
        cursor
        node {
          id
          name
          lineItems(first: 50) {
            nodes {
              name
              quantity
              variant {
                price
              }
              variantTitle
            }
          }
          shippingLine {
            id
            title
            __typename
          }
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
              __typename
            }
            presentmentMoney {
              amount
              currencyCode
              __typename
            }
            __typename
          }
          currentSubtotalLineItemsQuantity
          tags
          customer {
            id
            email
            firstName
            lastName
            __typename
          }
          __typename
        }
        __typename
      }
      pageInfo {
        hasPreviousPage
        startCursor
        hasNextPage
        endCursor
        __typename
      }
      __typename
    }
  }
`;

const DOWNLOAD_LIST_QUERY = `
  query DownloadListData($query: String, $savedSearchId: ID) {
    orders(
      first: 10
      reverse: true
      query: $query
      savedSearchId: $savedSearchId
    ) {
      edges {
        cursor
        node {
          id
          name
          lineItems(first: 10) {
            nodes {
              name
              quantity
              variant {
                price
              }
              variantTitle
            }
          }
          shippingLine {
            id
            title
            __typename
          }
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
              __typename
            }
            presentmentMoney {
              amount
              currencyCode
              __typename
            }
            __typename
          }
          currentSubtotalLineItemsQuantity
          tags
          customer {
            id
            email
            firstName
            lastName
            __typename
          }
          __typename
        }
        __typename
      }
      pageInfo {
        hasPreviousPage
        startCursor
        hasNextPage
        endCursor
        __typename
      }
      __typename
    }
  }
`;

const ADD_CARGO_TRACKING_NUMBER = `
mutation tagsAdd($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    node {
      id
    }
    userErrors {
      field
      message
    }
  }
}
`;

const FULFILLMENT_ORDER = `
    mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
            fulfillment {
                id
                status
            }
            userErrors {
                field
                message
            }
        }
    }
`;

// let session={"shop": "testaddictapp.myshopify.com" , "accessToken": "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", isActive: ()=>{return true}}

export default function applyPrintOrderApiEndpoints(app) {

  app.post("/api/ordersList", async (req, res) =>{ 
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    if (!session) {
      res.status(401).send("Could not find a Shopify session");
      return;
    }

    const client = new Shopify.Clients.Graphql(
      session.shop,
      session.accessToken
    );
    
    // Get orders
    let ordersList = await client.query({
      data: {
        query: ORDER_LIST_QUERY,
        variables: req.body.variables,
      },
    });

    let variables = {};
    if (req.body.variables.before == undefined) {
      variables = {
        ordersFirst: 10,
        after: ordersList.body.data.orders.pageInfo.endCursor,
        sortKey: "PROCESSED_AT",
        query: req.body.variables.query,
        reverse: req.body.variables.reverse,
      }
    }
    else {
      variables = {
        ordersLast: 10,
        before: ordersList.body.data.orders.pageInfo.startCursor,
        sortKey: "PROCESSED_AT",
        query: req.body.variables.query,
        reverse: req.body.variables.reverse,
      }
    }
    for (let i = 0; i < 4; i++) {
      if (req.body.variables.before == undefined) {
        const nextList = await client.query({
          data: {
            query: ORDER_LIST_QUERY,
            variables: variables,
          },
        });
    
        nextList.body.data.orders.edges.map(node => {
          ordersList.body.data.orders.edges.push(node);
        })
  
        variables = {
          ordersFirst: 10,
          after: nextList.body.data.orders.pageInfo.endCursor,
          sortKey: "PROCESSED_AT",
          query: req.body.variables.query,
          reverse: req.body.variables.reverse,
        }
        
        ordersList.body.data.orders.pageInfo.endCursor = nextList.body.data.orders.pageInfo.endCursor;
        ordersList.body.data.orders.pageInfo.hasNextPage = nextList.body.data.orders.pageInfo.hasNextPage;
        if (ordersList.body.data.orders.pageInfo.hasNextPage == false) break;
      }
      else {
        const nextList = await client.query({
          data: {
            query: ORDER_LIST_QUERY,
            variables: variables,
          },
        });

        nextList.body.data.orders.pageInfo.endCursor = ordersList.body.data.orders.pageInfo.endCursor;
        nextList.body.data.orders.pageInfo.hasNextPage = ordersList.body.data.orders.pageInfo.hasNextPage;
    
        ordersList.body.data.orders.edges.map(node => {
          nextList.body.data.orders.edges.push(node);
        })

        ordersList = nextList;
  
        variables = {
          ordersLast: 10,
          before: nextList.body.data.orders.pageInfo.startCursor,
          sortKey: "PROCESSED_AT",
          query: req.body.variables.query,
          reverse: req.body.variables.reverse,
        }
      }
      
    }

    const {Order} = await import (`@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`);

    const allCnt = await Order.count({
      session: session,
      status: 'any',
    });

    const processingCnt = await Order.count({
      session: session,
      fulfillment_status: 'unshipped,partial',
      financial_status: 'paid',
      created_at_min: req.body.createdAt,
    });

    const completeCnt = allCnt.count - processingCnt.count;

    const ret = {
      ordersList: ordersList,
      allCnt: allCnt.count,
      proCnt: processingCnt.count,
      comCnt: completeCnt,
      session: session,
    }

    res.status(200).send(ret);
  });

  app.post("/api/phoneSearch", async (req, res) =>{ 
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    if (!session) {
      res.status(401).send("Could not find a Shopify session");
      return;
    }

    const client = new Shopify.Clients.Graphql(
      session.shop,
      session.accessToken
    );

    let variables = {
      ordersFirst: 10,
      sortKey: "ID",
      reverse: true,
      query: req.body.variables.query,
    }
    
    let ordersList = {body: { data: { orders: { edges: []}}}}
    let next = true, phoneQuery = req.body.phone;
    while(next == true) {
       // Get orders
       const retGql = await client.query({
         data: {
           query: ORDER_LIST_QUERY,
           variables: variables,
         },
       })
       retGql.body.data.orders.edges.forEach((order) => {
        let phone = order.node.shippingAddress ? order.node.shippingAddress.phone : '';
          if (phone != null && phone.includes(String(phoneQuery))) {
            ordersList.body.data.orders.edges.push(order);
          }
       });
      next = retGql.body.data.orders.pageInfo.hasNextPage;
      variables = {
        ordersFirst: 10,
        sortKey: "ID",
        reverse: true,
        query: req.body.variables.query,
        after: retGql.body.data.orders.pageInfo.endCursor,
      }
     }

    res.status(200).send(ordersList);
  });

  app.post("/api/reportsList", async (req, res) =>{
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    
    if (!session) {
      res.status(401).send("Could not find a Shopify session");
      return;
    }

    const client = new Shopify.Clients.Graphql(
      session.shop,
      session.accessToken
    );
    
    // Get orders
    let next = true;
    let ordersList = [];
    let variables = req.body.variables
    while(next == true) {
      const subList = await client.query({
        data: {
          query: ORDER_LIST_QUERY,
          variables: variables,
        },
      });
      next = subList.body.data.orders.pageInfo.hasNextPage;
      variables = {
        ordersFirst: 10,
        sortKey: "ID",
        reverse: false,
        query: req.body.variables.query,
        after: subList.body.data.orders.pageInfo.endCursor,
      }
      ordersList.push(subList);
    }

    res.status(200).send(ordersList);
  })


  app.post("/api/downloadExcel", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );

    if (!session) {
      res.status(401).send("Could not find a Shopify session");
      return;
    }

    const client = new Shopify.Clients.Graphql(
      session.shop,
      session.accessToken
    );

    const workbook = new excelJS.Workbook();  // Create a new workbook
    const worksheet = workbook.addWorksheet("reports");

    worksheet.columns = [
      { header: " מספר משלוח", key: "shipping_num", width: 11},
      { header: "מחיר ליחידה", key: "price", width: 11 },
      { header: "כמות", key: "qty", width: 11 },
      { header: "מספר הזמנה", key: "order_num", width: 11 },
      { header: " שם הפריט", key: "there", width: 39 },
    ];

    worksheet.getColumn('A').style.alignment = { vertical: 'bottom', horizontal : 'right'};
    worksheet.getColumn('B').style.alignment = { vertical: 'bottom', horizontal : 'right'};
    worksheet.getColumn('C').style.alignment = { vertical: 'bottom', horizontal : 'right'};
    worksheet.getColumn('D').style.alignment = { vertical: 'bottom', horizontal : 'right'};
    worksheet.getColumn('E').style.alignment = { vertical: 'bottom', horizontal : 'right'};

     let next = true, variables = req.body.variables, start = req.body.start, end = req.body.end;
     let reportList = [];
     while(next == true) {
        // Get orders
        const retGql = await client.query({
          data: {
            query: ORDER_LIST_QUERY,
            variables: variables,
          },
        })

        retGql.body.data.orders.edges.forEach((order) => {
          let cargoN
          order.node.tags.map(t => {
            if (t.indexOf('Cargo') > -1) cargoN = t.split(':')[1]
          })
          
          order.node.lineItems.nodes.map(t1 => {
            const report = {
              there: t1.name,
              qty: t1.quantity,
              price : t1.variant ? t1.variant.price : '',
              order_num : Math.floor(order.node.name.replace(/\D/g, "")),
              shipping_num : cargoN
            }
            if (start == "") {
              if (end == "" || (report.order_num <= end && end != "")){
                reportList.push(report);
              }
            }
            else {
              if ((start <= report.order_num && end == "") || (start <= report.order_num && report.order_num <= end && end !="")) {
                reportList.push(report);
              }
            }
          })
        });
       next = retGql.body.data.orders.pageInfo.hasNextPage;
       variables = {
         ordersFirst: 10,
         sortKey: "ID",
         reverse: false,
         query: "Cargo Tracking: fulfillment_status:\"unshipped\"",
         after: retGql.body.data.orders.pageInfo.endCursor,
       }
      }

      reportList.sort(function(a, b){ if (a.there < b.there) return -1; if (a.there > b.there) return 1; return 0; });

      if (reportList.length > 0) {
          let there = reportList[0].there, qty = reportList[0].qty;
          for (let i = 1; i < reportList.length; i++) {
            if (there == reportList[i].there) {
              qty = qty + reportList[i].qty;
              reportList[i - 1].qty = 0;
              reportList[i].qty = qty;
            } else {
              reportList[i - 1].qty = qty;
              qty = reportList[i].qty;
              there = reportList[i].there;
              worksheet.addRow(reportList[i - 1]); // Add data in worksheet
            }
          }
    
          worksheet.addRow(reportList[reportList.length - 1]); // Add data in worksheets
      }

    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "tutorials.xlsx"
    );

    workbook.xlsx.write(res).then(function () {
      res.status(200).send();
    });
  })

  app.post("/api/fulfillmentOrders", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    
    if (!session) {
      res.status(401).send("Could not find a Shopify session");
      return;
    }

    const client = new Shopify.Clients.Graphql(
      session.shop,
      session.accessToken
    );
    
    let fulfillmentIds = req.body.fulfillmentIds;
    fulfillmentIds.map(async orderId => {
      const fulfillment = await client.query({
        data: {
          query: FULFILLMENT_ORDER,
          variables: {
            fulfillment: {
              lineItemsByFulfillmentOrder: {
                fulfillmentOrderId: orderId,
              }
            }
          },
        },
      });
    })

    res.status(200).send();
  })

  app.post("/api/printLabel", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    const {Order, Page } = await import (`@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`);

    let ids = '';
    let selIds = req.body.selIds;

    let len = selIds.length;
    for(let i = 0; i<len; i++){
      ids += selIds[i].id.toString();
      if (i< len -1) ids += ','

    }

    const orders= await Order.all({
      session: session,
      status: "any",
      fields: "billing_address,shipping_address,note,name,order_number,contact_email,tags,line_items,admin_graphql_api_id,created_at,total_price_set,transactions,shipping_lines,app_id",
      ids,
    });

    // const orders = req.body.printOrders;

    let html = `
      <link rel="stylesheet" href="https://allwp.addictonline.co.il/wp-content/themes/matat-child/template/labels.css"></link>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
      <script src="https://cdn.jsdelivr.net/jsbarcode/3.6.0/JsBarcode.all.min.js"></script>
      <script src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.3.4/jspdf.min.js"></script>
      <style type="text/css"> 
        .main-page-title {
          display:none !important;
        }
        
        tr{
          word-break: break-word;
        }

        head {
          display: none;
        }

        .newsletter {
          display: none !important;
          color: 'red' !important;
        }
        
        /* Print Styles */
        @media print {
          @page {
            size: 100mm 150mm;
            padding: 0 !important;
            margin: 0 !important;
          }

          @page :footer {
            display: none;
            padding: 0 !important;
            margin: 0 !important;
          }

          @page :header {
            display: none;
            padding: 0 !important;
            margin: 0 !important; 
          }

          html, body {
            padding: 0 !important;
            margin: 0 !important;
          }

          .sticker-page-wrapper1,
          .sticker-page-wrapper2,
          .sticker-page-wrapper3 {
            font-size: 12px !important;
            height: 100%;
            padding-top: 1.7em !important;
          }

          .sticker-page-wrapper1 .bar-code,
          .sticker-page-wrapper2 .bar_code_wrap,
          .sticker-page-wrapper3 .bar-code {
            padding-top: 0 !important;
            padding: 0 !important;
          }

          .sticker-page-wrapper3 .middle-content {
            font-size: 1.2em !important;
          }

          .sticker_wrapper {
            box-sizing: border-box;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
        }

        .bottom_date {
          float: left !important;
        }

        .sticker-page-wrapper1 {
          box-sizing: border-box;
          -webkit-text-size-adjust: 100%;
        }

        .sticker-page-wrapper1 *, .sticker-page-wrapper1 *:before, .sticker-page-wrapper1 *:after {
          box-sizing: inherit;
        }

        .sticker-page-wrapper1 {
          direction: rtl;
          color: #000;
          background: #fff;
          font: 2.941176471vw/1.5 'Heebo', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          margin: 0;
        }

        @media (min-width: 544px) {
          .sticker-page-wrapper1 {
            font-size: 16px;
          }
        }

        .sticker-page-wrapper1 .sticker_wrapper {
          max-width: 35.3125em;
          margin: 0 auto;
          padding-bottom: 0 1em 0em !important;
          position: relative;
          min-height: 95vh;
        }

        .sticker-page-wrapper1 img {
          vertical-align: top;
          max-width: 100%;
          height: auto;
        }

        .sticker-page-wrapper1 .sticker_date {
          font-weight: 500;
          text-align: center;
          padding: 0.1875em;
        }

        .sticker-page-wrapper1 .bar-code {
          margin: 0 auto;
          width: 14.4375em;
          padding: 1em 0;
        }

        .sticker-page-wrapper1 .bar-code img {
          width: 100%;
        }

        .sticker-page-wrapper1 table {
          width: 100%;
          border: 1px solid #000;
          border-collapse: collapse;
        }

        .sticker-page-wrapper1 table th,
        .sticker-page-wrapper1 table td {
          border: 1px solid #000;
          padding: 0.5em 1.25em 0.4375em;
        }

        .sticker-page-wrapper1 table tbody th {
          width: 55.2%;
          text-align: right;
          font-weight: 500;
          padding-right: 2.125em !important;
        }

        .sticker-page-wrapper1 table tbody td {
          padding-right: 2.125em !important;
        }

        .sticker-page-wrapper1 tfoot td {
          background: #eaebeb;
          text-align: center;
        }

        .sticker-page-wrapper1 .bottom-logo {
          margin: 0 auto;
          width: 14.4374em;
          bottom: 0em;
          position: absolute;
          left: 0;
          right: 0;
        }

        .sticker-page-wrapper1 .bottom-logo img {
          margin: 0 auto !important;
          width: 100%;
        }
        .sticker-page-wrapper2 {
          box-sizing: border-box;
          -webkit-text-size-adjust: 100%;
        }

        .sticker-page-wrapper2 *, .sticker-page-wrapper2 *:before, .sticker-page-wrapper2 *:after {
          box-sizing: inherit;
        }

        .sticker-page-wrapper2 {
          direction: rtl;
          color: #000;
          background: #fff;
          font: 2.941176471vw/1.5 'Heebo', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          margin: 0;
        }

        @media (min-width: 544px) {
          .sticker-page-wrapper2 {
            font-size: 16px;
          }
        }

        .sticker-page-wrapper2 .sticker_wrapper {
          max-width: 35.3125em;
          margin: 0 auto;
          padding-bottom: 0 1em 0em !important;
          position: relative;
          min-height: 95vh;
        }

        .sticker-page-wrapper2 img {
          vertical-align: top;
          max-width: 100%;
          height: auto;
        }

        .sticker-page-wrapper2 .sticker_date {
          font-weight: 500;
          text-align: center;
          padding: 0.5em;
        }

        .sticker-page-wrapper2 .bar_code_wrap {
          display: flex;
          padding: 0.5em 0 1em;
        }

        .sticker-page-wrapper2 .order_detail_info {
          padding: 0.1875em 0em !important;
          margin-right: -0.5em !important;
        }

        .bar-code {
          margin: 0 auto 0 0;
          width: 14.125em;
        }

        .sticker-page-wrapper2 .bar-code img {
          width: 100%;
        }

        .sticker-page-wrapper2 table {
          width: 100%;
          border: 1px solid #000;
          border-collapse: collapse;
          font-size: 0.875em;
          margin: 0 0 1.3571em;
        }

        .sticker-page-wrapper2 table th,
        .sticker-page-wrapper2 table td {
          border: 1px solid #000;
        }

        .sticker-page-wrapper2 table .sku {
          width: 7.75em;
        }

        .sticker-page-wrapper2 table .amount {
          width: 4.1667em;
        }

        .sticker-page-wrapper2 table .item_name {
          width: 20em;
        }

        .sticker-page-wrapper2 table .return {
          width: 4.5em;
        }

        .sticker-page-wrapper2 .text-center {
          font-weight : 500 !important;
          text-align: center !important;
        }

        .sticker-page-wrapper2 table .reason_code {
          width: 7.25em;
        }

        .sticker-page-wrapper2 table thead td,
        .sticker-page-wrapper2 table thead th {
          text-align: right;
          font-size: 0.75em;
          font-weight: 500;
          padding: 0.2em !important;
        }

        .sticker-page-wrapper2 table tbody td {
          padding: 0.5714em 0.52em 0.53em !important;
        }

        .sticker-page-wrapper2 .form_title {
          display: block;
          margin: 0 0 0.4375em;
        }

        .sticker-page-wrapper2 .checkbox_wrap {
          display: inline-block;
          vertical-align: top;
          text-align: right;
          position: relative;
          margin: 0 1.0625em;
        }

        .sticker-page-wrapper2 .checkbox_wrap label {
          display: inline-block;
          vertical-align: top;
          padding-right: 1.9375em;
        }

        .sticker-page-wrapper2 .checkbox_wrap label input[type="checkbox"] {
          position: absolute;
          top: 0;
          right: 0;
          opacity: 0;
        }

        .sticker-page-wrapper2 .checkbox_wrap label input[type="checkbox"]:checked ~ .fake-input:before {
          opacity: 1;
        }

        .sticker-page-wrapper2 .checkbox_wrap .fake-input {
          position: absolute;
          top: 0;
          right: 0;
          width: 1.4375em;
          height: 1.4375em;
          border: 1px solid #000;
        }

        .sticker-page-wrapper2 .checkbox_wrap .fake-input:before {
          content: '';
          position: absolute;
          border: 2px solid #000;
          border-width: 0 2px 2px 0;
          width: 0.4375em;
          height: 0.875em;
          top: 45%;
          right: 50%;
          opacity: 0;
          transition: 0.25s ease opacity;
          -webkit-transform: translate(50%, -50%) rotate(45deg);
          -moz-transform: translate(50%, -50%) rotate(45deg);
          -ms-transform: translate(50%, -50%) rotate(45deg);
          -o-transform: translate(50%, -50%) rotate(45deg);
          transform: translate(50%, -50%) rotate(45deg);
        }

        .sticker-page-wrapper2 .bottom-info {
          font-size: 0.75em;
          padding: 0.25em 0 0.6667em;
        }

        .sticker-page-wrapper2 textarea.notes_input {
          display: block;
          width: 100%;
          resize: none;
          border: 1px solid #000;
          color: #000;
          background: #eaebeb;
          font: 500 1em/1 'Heebo', sans-serif;
          height: 2.625em;
          padding: 0.6875em 0.875em;
        }

        .sticker-page-wrapper2 .bottom-logo {
          margin: 0 auto;
          width: 14.4374em;
          bottom: 0em;
          position: absolute;
          left: 0;
          right: 0;
        }

        .sticker-page-wrapper2 .bottom-logo img {
          margin: 0 auto !important;
          width: 100%;
        }
        .sticker-page-wrapper3 {
          box-sizing: border-box;
          -webkit-text-size-adjust: 100%;
        }

        .sticker-page-wrapper3 *, .sticker-page-wrapper3 *:before, .sticker-page-wrapper3 *:after {
          box-sizing: inherit;
        }

        .sticker-page-wrapper3 {
          direction: rtl;
          color: #000;
          background: #fff;
          font: 2.941176471vw/1.5 'Heebo', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          margin: 0;
        }

        @media (min-width: 544px) {
          .sticker-page-wrapper3 {
            font-size: 12px;
          }
        }

        .sticker-page-wrapper3 .sticker_wrapper {
          max-width: 35.3125em;
          margin: 0 auto;
          padding-bottom: 0 1em 0em !important;
          position: relative;
          min-height: 95vh;
        }

        .sticker-page-wrapper3 img {
          vertical-align: top;
          max-width: 100%;
          height: auto;
        }

        .sticker-page-wrapper3 .bar-code {
          margin: 0 auto;
          width: 24.4375em;
          padding: 1em 0;
        }

        .sticker-page-wrapper3 .bar-code img {
          width: 85%; 
          display: block;
        }

        .sticker-page-wrapper3 .top-info-text {
          text-align: center;
          border: 1px solid #000;
          background: #eaeceb;
          padding: 0.3333em 0.5em 0.4583em;
          font-size: 1.2em;
          line-height: 1.6667;
          margin-top: 1.5em;
        }

        .sticker-page-wrapper3 .top-info-text strong {
          font-weight: 500;
          display: block;
        }

        .sticker-page-wrapper3 .middle-content {
          font-size: 1.2em;
          line-height: 2.3958;
          padding: 2.2083em 0.3333em 1.125em;
        }

        .sticker-page-wrapper3 strong {
          font-weight: 500;
        }

        .sticker-page-wrapper3 .middle-content .title-text {
          display: block;
          font-size: 1em;
          line-height: 1.5;
          margin-bottom: 0.0714em;
        }

        .sticker-page-wrapper3 .bottom-info-text {
          text-align: center;
          border: 1px solid #000;
          background: #eaeceb;
          font-size: 1.2em;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          line-height: 1.9167;
          padding: 0.25em 0 0.375em;
        }

        .sticker-page-wrapper3 .bottom-info-text .data {
          margin: 0 0.75em;
        }

        .sticker-page-wrapper3 .bottom-logo {
          margin: 0 auto;
          width: 14.4374em;
          bottom: 0em;
          position: absolute;
          left: 0;
          right: 0;
        }

        .sticker-page-wrapper3 .bottom-logo img {
          margin: 0 auto !important;
          width: 100%;
        }

        #shopify-section-announcement-bar {
          display: none;
        }
        
        #shopify-section-header {
          display: none;
        }

        @page :title {
          display: none;
          padding: 0 !important;
          margin: 0 !important;
        }

        .page-header {
          display: none;
          padding: 0 !important;
          margin: 0 !important;
        }

        .bar-code-dev {
          margin: 0 !important;
        }

        .bar-code-order {
          margin: 0 !important;
        }

        .shopify-section--footer {
          display: none !important;
        }  
        
        .smart-accessibility-widget {
          display: none !important;
        }    
      </style>
    `;
    
    let devnum = '', ordernum = '', kav = '', devnum_array = [orders.length], ordernum_array = [orders.length], shopify_order_id = '', email = '', shopify_order_id_array = [], count = 0, subHtml = [orders.length - 1];
    await asyncForEach(orders, async (order, index) => {
      // let order_shipping_first_name = order.shipping_address && order.shipping_address.first_name ? order.shipping_address.first_name : "";
      // let order_shipping_last_name = order.shipping_address && order.shipping_address.last_name ? order.shipping_address.last_name : "";
      // let shipping_address_1 = order.shipping_address && order.shipping_address.address1 ? order.shipping_address.address1 : "";
      // let shipping_address_2 = order.shipping_address && order.shipping_address.address2 ? order.shipping_address.address2 : "";
      // let shipping_phone = order.shipping_address && order.shipping_address.phone ? order.shipping_address.phone : "";
      // let city = order.shipping_address && order.shipping_address.city ? order.shipping_address.city : "";
      // let note = order.note ? order.note : "";
      // let shopify_order_id = order.name ? order.name : "";
      // let items = order.line_items || [];
      // let time_now = moment(new Date()).format('MM-DD-YYYY');
      // let lb_num_from = 3;
      // if(items.length > 6 ) lb_num_from = 2 + Math.ceil(items.length / 6);

      // const apiUrl = "http://185.241.7.143/Baldarp/Service.asmx";

      // let ship_data ={
      //   type: '1',
      //   collect_street: "יוחנן הסנדלר",
      //   collect_street_number: 5,
      //   collect_city: "הרצליה",
      //   collect_company: "ADDICT",
      //   code: 125,
      //   street: order.shipping_address && order.shipping_address.address1 ? order.shipping_address.address1 : '',
      //   number: order.shipping_address && order.shipping_address.address2 ? order.shipping_address.address2 : '',
      //   city: order.shipping_address && order.shipping_address.city ? order.shipping_address.city : '',
      //   company: order.shipping_address && order.shipping_address.company ? order.shipping_address.company : '',
      //   note: note,
      //   urgent: '1',
      //   tapuz_static: '0',
      //   tapuz_empty: '',
      //   motor: '1',
      //   packages: '1',
      //   return: '1',
      //   woo_id: shopify_order_id,
      //   extra_note: '',
      //   contact_name: (order.shipping_address && order.shipping_address.first_name ? order.shipping_address.first_name : '') + ' ' + (order.shipping_address && order.shipping_address.last_name ? order.shipping_address.last_name : ''),
      //   contact_phone: order.shipping_address && order.shipping_address.phone ? order.shipping_address.phone : '',
      //   contact_mail: order.contact_email ? order.contact_email : '',
      //   exaction_date: moment(new Date()).format('YYYY-MM-DD'),
      //   collect: '',
      //   delivery_time: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
      // }
      
      // let devnum_idx = -1;
      // let kav_idx = -1;
      // let formBody = [];
      // formBody.push(ship_data.type);
      // formBody.push(ship_data.collect_street);
      // formBody.push(ship_data.collect_street_number);
      // formBody.push(ship_data.collect_city);
      // formBody.push(ship_data.street);
      // formBody.push(ship_data.number);
      // formBody.push(ship_data.city);
      // formBody.push(ship_data.collect_company);
      // formBody.push(ship_data.company);
      // formBody.push(ship_data.note);
      // formBody.push(ship_data.urgent);
      // formBody.push(ship_data.tapuz_static);
      // formBody.push(ship_data.motor);
      // formBody.push(ship_data.packages);
      // formBody.push(ship_data.return);
      // formBody.push(ship_data.tapuz_static);
      // formBody.push(ship_data.woo_id);
      // formBody.push(ship_data.code);
      // formBody.push(ship_data.tapuz_static);
      // formBody.push(ship_data.extra_note);
      // formBody.push(ship_data.tapuz_static);
      // formBody.push(ship_data.tapuz_empty);
      // formBody.push(ship_data.tapuz_empty);
      // formBody.push(ship_data.contact_name);
      // formBody.push(ship_data.contact_phone);
      // formBody.push(ship_data.contact_mail);
      // formBody.push(ship_data.exaction_date);
      // formBody.push(ship_data.collect);

      // formBody = formBody.join(";");
      // ordernum = "RR";
      // let orderId = ( Math.floor(order.name.replace(/\D/g, "")) - 212724) % 999999998 + 1;
      // for (let i = 0; i < 9 - String(orderId).length ; i++) {
      //   ordernum = ordernum + '0';
      // }
      // ordernum = ordernum + String(orderId) + '1B';

      // let cargoStatus = false;
      // cargoStatus = order.tags.includes('Cargo');

      // if (!cargoStatus){
      //   const response = await fetch(
      //     `${apiUrl}/SaveData1`,
      //     {
      //       method: "POST",
      //       headers: {
      //         "Content-Type": "application/x-www-form-urlencoded"
      //       },
      //       body: encodeURIComponent("pParam")+"="+encodeURIComponent(formBody),
      //     }
      //   ).then(response => response.text())
      //   let result = JSON.parse(convert.xml2json(response,{compact: true, spaces: 2}));
      //   devnum = parseInt(result.SaveDataResult.DeliveryNumber._text);
      //   const arr = result.SaveDataResult.DeliveryNumberString._text.split(";");
      //   devnum = arr[0];
      //   kav = arr[1];

      //   const client = new Shopify.Clients.Graphql(
      //     session.shop,
      //     session.accessToken
      //   );
  
      //   const addTags = await client.query({
      //     data: {
      //       query: ADD_CARGO_TRACKING_NUMBER,
      //       variables: {
      //         id: order.admin_graphql_api_id,
      //         tags: "Cargo Tracking:" + devnum + ", LineNumber:" + kav + ", RRcode:" + ordernum,                      
      //       },
      //     },
      //   });
      // }   
      // else {
      //   let label = order.tags;
      //   let startIndexDevnum = label.indexOf('Cargo') + 15;
      //   let endIndexDevnum = label.indexOf(',', startIndexDevnum)
      //   let startIndexLinenum = label.indexOf('LineNumber') + 11;
      //   let endIndexLinenum = label.indexOf(',', startIndexLinenum)
      //   devnum = label.slice(startIndexDevnum, endIndexDevnum)
      //   kav = label.slice(startIndexLinenum, endIndexLinenum)
      // }

      let order_shipping_first_name = order.shipping_address && order.shipping_address.first_name ? order.shipping_address.first_name : "";
      let order_shipping_last_name = order.shipping_address && order.shipping_address.last_name ? order.shipping_address.last_name : "";
      let shipping_address_1 = order.shipping_address && order.shipping_address.address1 ? order.shipping_address.address1 : "";
      let shipping_address_2 = order.shipping_address && order.shipping_address.address2 ? order.shipping_address.address2 : "";
      let shipping_phone = order.shipping_address && order.shipping_address.phone ? order.shipping_address.phone : "";
      let shipping_company = order.shipping_address && order.shipping_address.company ? order.shipping_address.company : "";
      let city = order.shipping_address && order.shipping_address.city ? order.shipping_address.city : "";
      let country = order.shipping_address && order.shipping_address.country ? order.shipping_address.country : "";
      let zip = order.shipping_address && order.shipping_address.zip ? order.shipping_address.zip : "";
      let note = order.note ? order.note : "";
      shopify_order_id = order.name ? order.name : "";
      let items = order.line_items;
      let time_now = moment(new Date()).format('MM/DD/YYYY');
      email = order.contact_email;
      let lb_num_from = 3;
      if(items.length > 6 ) lb_num_from = 2 + Math.ceil(items.length / 6);
      let boxStatus = order.shipping_lines.length == 0 || (order.shipping_lines.length != 0 && order.shipping_lines[0].source != "Cargo service") ? false : true;

      shopify_order_id_array.push(shopify_order_id);

      let cargoStatus = false; 
      cargoStatus = order.tags.includes('Cargo');

      let ship_data = {
        shipping_type: 1,
        to_address: {
            name: order_shipping_first_name + ' ' + order_shipping_last_name,
            company: shipping_company,
            street1: shipping_address_1,
            street2: shipping_address_2,
            entrance: '',
            floor: '',
            appartment: '',
            city: city,
            state: 'IL',
            zip: zip,
            country: country,
            phone: shipping_phone,
            email: email
        },
        from_address: {
            name:  order_shipping_first_name + ' ' + order_shipping_last_name,
            company: "ADDICT",
            street1: "5",
            street2: "יוחנן הסנדלר",
            entrance: '',
            floor: '',
            appartment: '',
            city: "הרצליה",
            state: "IL",
            zip: zip,
            country: country,
            phone: "035017825",
            email: email
        },
        noOfParcel: 0,
        barcode: '',
        return_order: '',
        doubleDelivery: 1,
        TotalValue: order.total_price_set.shop_money.amount,
        TransactionID: order.name,
        ContentDescription: '',
        CashOnDeliveryTypes: 0,
        CarrierName: '',/////
        CarrierService: '',
        CarrierID: 1,
        OrderID: order.app_id,
        PaymentMethod: '',
        Note: note,
        customerCode: '125',
      }

      // ordernum = "RR";
      // let orderIdd = ( Math.floor(order.name.replace(/\D/g, "")) - 212724) % 999999998 + 1;
      // for (let i = 0; i < 9 - String(orderIdd).length ; i++) {
      //   ordernum = ordernum + '0';
      // }
      // ordernum = ordernum + String(orderIdd) + '1B';

      if (!cargoStatus){
        const response = axios.post(`https://api.cargo.co.il/Webservice/CreateShipment`, {
          Method: "Ship",
          Params: ship_data
          }).then(async response => {
            devnum = response.data.shipmentId;
            kav = response.data.linetext;

            const client = new Shopify.Clients.Graphql(
              session.shop,
              session.accessToken
            );
            ordernum = "RR";
            let orderIdd = ( Math.floor(order.name.slice(2, order.name.length)) - 212724) % 999999998 + 1;
            for (let i = 0; i < 9 - String(orderIdd).length ; i++) {
              ordernum = ordernum + '0';
            }
            ordernum = ordernum + String(orderIdd) + '1B';
            const addTags = await client.query({
              data: {
                query: ADD_CARGO_TRACKING_NUMBER,
                variables: {
                  id: order.admin_graphql_api_id,
                  tags: "Cargo Tracking:" + devnum + ", LineNumber:" + kav + ", RRcode:" + ordernum,                      
                },
              },
            }).then(() => {
              devnum_array[index] = response.data.shipmentId;
              ordernum = "RR";
              let orderIdd = ( Math.floor(order.name.slice(2, order.name.length)) - 212724) % 999999998 + 1;
              for (let i = 0; i < 9 - String(orderIdd).length ; i++) {
                ordernum = ordernum + '0';
              }
              ordernum = ordernum + String(orderIdd) + '1B';
              ordernum_array[index] = ordernum;
              subHtml[index] = test(response.data.shipmentId, response.data.linetext, ship_data.TransactionID, ordernum);
              if (count == orders.length - 1) {
                for (let i = 0; i < orders.length; i++) {
                  html += subHtml[i];
                }
                script(); 
                res.status(200).send({content : html});
              }
              count++;
            });
          });
    }   
      else {
        let label = order.tags;
        let startIndexDevnum = label.indexOf('Cargo') + 15;
        let endIndexDevnum = label.indexOf(',', startIndexDevnum)
        let startIndexLinenum = label.indexOf('LineNumber') + 11;
        let endIndexLinenum = label.indexOf(',', startIndexLinenum)
        devnum = label.slice(startIndexDevnum, endIndexDevnum)
        kav = label.slice(startIndexLinenum, endIndexLinenum)
        devnum_array[index] = devnum;
        ordernum = "RR";
        let orderIdd = ( Math.floor(order.name.slice(2, order.name.length)) - 212724) % 999999998 + 1;
        for (let i = 0; i < 9 - String(orderIdd).length ; i++) {
          ordernum = ordernum + '0';
        }
        ordernum = ordernum + String(orderIdd) + '1B';
        ordernum_array[index] = ordernum;
        subHtml[index] = test(devnum, kav, order.name, ordernum)
        if (count == orders.length - 1) {
          for (let i = 0; i < orders.length; i++) {
            html += subHtml[i];
          }
          script(); 
          res.status(200).send({content : html});
        }
        count++;
      }

      function test(devnum, kav, shopify_order_id, ordernum) {
        let html = '';
        html += `
        <div class="sticker-page-wrapper1">
          <div class="sticker_wrapper">
            <div class="bar-code">
              <img class="bar-code-dev bar-code-dev-${index}" src="">
              <div style="padding-right: 6px">${devnum}</div>
            </div>
            <table>
              <tbody>
                <tr>
                  <th>מאת ADDICT</th>
                  <td><div style="float:right">${shopify_order_id}</div></td>
                </tr>
                <tr>
                  <th>יוחנן הסנדלר 5 הרצליה</th>
                  <td>מ-1-1</td>
                </tr>
                <tr>
                  <th>
                    עבור: ${order_shipping_first_name} ${order_shipping_last_name}
                  </th>
                  <td>
                    ${shipping_address_1} ${shipping_address_2} ${city}
                  </td>
                </tr>
                <tr>
                  <th>מספר קו</th>
                  <td>${kav}</td>
                </tr>
                <tr>
                  <th> טלפון: ${shipping_phone}</th>
                  <td>רגיל</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">
                  ${shipping_address_1} ${shipping_address_2} ${city} &nbsp;|&nbsp; טלפון: ${shipping_phone} &nbsp;|&nbsp;  הערות: ${note}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div>1 מתוך ${lb_num_from} <span class="bottom_date">${time_now}</span></div>
            <div class="bottom-logo">
              <img src="data:image/png;base64,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" alt="addict">
            </div>
          </div>
        </div>`
  
        let lb_num = 2;
        array_chunk(items,6).forEach((items_data) => {
  
          html += `
          <div class="sticker-page-wrapper2">
            <div class="sticker_wrapper">
              <div class="bar_code_wrap">
                <div class="order_detail_info">
                  <div class="data_row">
                    עבור:${order_shipping_first_name} ${order_shipping_last_name}
                  </div>
                  <div class="data_row">מס׳ הזמנה:${shopify_order_id}</div>
                </div>
                <div class="bar-code">
                  <img class="bar-code-dev bar-code-dev-${index}" src="">
                  <div style="padding-right: 6px">${devnum}</div>
                </div>
              </div>
              <div class="form_title text-center">נא סמני ב- "X" איזה פריט את מחזירה וצרפי את המדבקה הנ"ל לתוך החבילה</div>
              <table>
                <thead>
                  <tr>
                    <th class="sku text-center">מק׳׳ט</th>
                    <th class="amount text-center">כמות</th>
                    <th class="item_name text-center">שם פריט</th>
                    <th class="return text-center">החזרה</th>
                    <th class="reason_code text-center">קוד סיבת החזרה</th>
                  </tr>
                </thead>
                <tbody>`;
  
                  items_data.forEach((item) => {
                    let product_idx = item.sku ? item.sku : item.product_id;
                    html +=`
                    <tr>
                      <td class="text-center">&nbsp;</td>
                      <td class="text-center">&nbsp;${item.quantity}</td>
                      <td class="text-center">&nbsp;${item.name}
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>`;
  
                  });
  
                html +=`
                </tbody>
              </table>
              <form action="#">
                <div class="form_title text-center">סמני כיצד תרצי לקבל את הזיכוי:</div>
                <div class="checkbox-row text-center">
                  <div class="checkbox_wrap">
                    <label>
                      <input type="checkbox">
                      <span class="fake-input"></span>
                      <span class="label-text">זיכוי כספי</span>
                    </label>
                  </div>
                  <div class="checkbox_wrap">
                    <label>
                      <input type="checkbox">
                      <span class="fake-input"></span>
                      <span class="label-text">קרדיט באתר</span>
                    </label>
                  </div>
                </div>
                <div class="bottom-info text-center">החזר כספי בניכוי של 5% משווי הפריט *</div>
                <textarea class="notes_input" placeholder="הערות נוספות:"></textarea>
              </form>
              <div>${lb_num} מתוך ${lb_num_from}<span class="bottom_date">${time_now}</span></div>
              <div class="bottom-logo">
                <img src="data:image/png;base64,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" alt="addict">
              </div>
            </div>
          </div>`;
          lb_num ++;
        });
        
        html +=`
        <div class="sticker-page-wrapper3">
          <div class="sticker_wrapper">
            <div class="bar-code">
              <img class="bar-code-order bar-code-order-${index}" src="">
              <div style="padding-right: 6px">${ordernum}</div>
            </div>
            <div class="top-info-text">
              תגוביינא רשום מיוחד- אין צורך בבול <strong>אישור מס׳ 16941</strong>
            </div>
            <div class="middle-content">
              <strong class="title-text">לכבוד:</strong>
              אדיקט נ.א בע"מ <br>
              באמצעות בית הדואר <strong>רמת השרון</strong> <br>
              תא דואר <strong>1771</strong> <br>
              רמת השרון <strong>4710001</strong>
            </div>
            <div class="bottom-info-text">
              <div class="data">
                <strong>שם לקוח:</strong> ${order_shipping_first_name} ${order_shipping_last_name}
              </div>
              <div class="data">
                <strong>מס׳ הזמנה:</strong> ${shopify_order_id}
              </div>
            </div>
            <div style="display:inline-block">${lb_num} מתוך ${lb_num_from}</div>
            <div class="bottom-logo">
              <img src="data:image/png;base64,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" alt="addict">
            </div>
          </div>
        </div>`;
        return html;
      }
    })

    function script() {
      html +=`
      <script>
          function textToBase64Barcode(text){
          var canvas = document.createElement("canvas");
          JsBarcode(canvas, text, {
            width: 7,
            displayValue: false,
            textAlign: "right",
            marginRight: 0,
          });
          return canvas.toDataURL("image/png");
        }`;
  
        for (var i = 0; i < orders.length; i++) {
          html +=`
            $('.bar-code-dev-` + i + `').attr('src', textToBase64Barcode('` + devnum_array[i] + `'));
            $('.bar-code-order-` + i + `').attr('src', textToBase64Barcode('` + ordernum_array[i] + `'));`
        }
  
      html +=`
        $('.shopify-section--popup').remove();
        $('.shopify-section--header').remove();
        $('.shopify-section--mini-cart').remove();
      </script>
      `;
    }

    // const pages= await Page.all({
    //   session: session,
    // });
  
    // let isExisted = -1;
    // isExisted = pages.findIndex((item) => item.title == "print_label");

    // if(isExisted < 0 ) 
    // {
    //   const page = new Page({session: session});
    //   page.title = "print_label";
    //   page.body_html = html;

    //   await page.save({
    //     update: true,
    //   });
    // } else {
    //   const page = pages[isExisted];
    //   page.body_html = html;

    //   await page.save({
    //     update: true,
    //   });

    // }    
  });
}

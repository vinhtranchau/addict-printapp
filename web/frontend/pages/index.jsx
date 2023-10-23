import { useNavigate, TitleBar, Loading } from '@shopify/app-bridge-react';
import {
	Card,
	EmptyState,
	Layout,
	Page,
	SkeletonBodyText,
	Tabs,
	Select,
	Button,
	Icon,
	TextField,
	Pagination,
	Spinner,
} from "@shopify/polaris";
import { OrderIndex } from "../components";
import { useAuthenticatedFetch, useAppQuery } from "../hooks";

import { useState, useCallback } from 'react';
import { SearchMinor, FilterMajor, ImageMajor } from "@shopify/polaris-icons"

import { useEffect } from 'react';

import { ScrollRestoration, useSearchParams } from "react-router-dom";

import ReactDOMServer from "react-dom/server";
import { jsPDF } from "jspdf";
import parse from "html-react-parser";
import { unstable_renderSubtreeIntoContainer } from 'react-dom';

const currency = {
	"USD": "$",
	"ILS": "₪",
}

export default function HomePage() {

	/*
		Add an App Bridge useNavigate hook to set up the navigate function.
		This function modifies the top-level browser URL so that you can
		navigate within the embedded app and keep the browser in sync on reload.
	*/
	const navigate = useNavigate();
	const fetch = useAuthenticatedFetch();
	const nowDate = new Date(new Date(new Date().setTime(new Date().getTime() - 86400000 * 55)).toString());
	const defaultPrevDate = nowDate.getFullYear() + "-" + ((nowDate.getMonth()+1) < 10 ? ('0' + (nowDate.getMonth()+1)) : (nowDate.getMonth()+1)) + "-" + (nowDate.getDate() < 10 ? ('0' + nowDate.getDate()) : nowDate.getDate());

	const [selectedTab, setSelectedTab] = useState(1);
	const [tabquery, setTabquery] = useState('status:"open" fulfillment_status:"unshipped,partial" financial_status:"paid" created_at:>"' + defaultPrevDate + '"')
	const [customerDateQuery, setCustomerDateQuery] = useState('')
	const [shopName, setShopName] = useState('')
	const [startOrderNumber, setStartOrderNumber] = useState('');
	const [endOrderNumber, setEndOrderNumber] = useState('');
	const [startCustomerDate, setStartCustomerDate] = useState('');
	const [endCustomerDate, setEndCustomerDate] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [proCnt, setProCnt] = useState(0);
	const [comCnt, setComCnt] = useState(0);
	const [allCnt, setAllCnt] = useState(0);
	const [sort, setSort] = useState(false);

	const handleTabChange = useCallback(
		(selectedTabIndex) => {
			setSelectedTab(selectedTabIndex)
			if (selectedTabIndex == 0) {
				setTabquery('created_at:>"' + defaultPrevDate + '"');
			} else if (selectedTabIndex == 1) {
				setTabquery('status:"open" fulfillment_status:"unshipped,partial" financial_status:"paid" created_at:>"' + defaultPrevDate + '"');

			} else if (selectedTabIndex == 2) {
				setTabquery('fulfillment_status:"shipped" OR NOT financial_status:"paid" created_at:>"' + defaultPrevDate + '"');
			}
		},
		[],
	);

	const tabs = [
		{
			id: 'all-orders-1',
			content: 'All ( ' + allCnt + ' )',
			accessibilityLabel: 'All orders',
			panelID: 'all-orders-content-1',
		},
		{
			id: 'processing-orders-1',
			content: 'Processing ( ' + proCnt + ' )',
			panelID: 'processing-orders-content-1',
		},
		{
			id: 'fulfillment-orders-1',
			content: 'Fulfillment ( ' + comCnt + ' )',
			panelID: 'fulfillment-orders-content-1',
		},
	];

	const [isLoading, setIsLoading] = useState(false);
	const [originOrdersList, setOriginOrdersList] = useState([])
	const [ordersList, setOrdersList] = useState({})
	const [pageInfo, setPageInfo] = useState({})
	const [prePageInfo, setPrePageInfo] = useState({})
	const [nextPageInfo, setNextPageInfo] = useState({})
	const [query, setQuery] = useState('')
	const [orderQuery, setOrderQuery] = useState('')

	const [dayquery, setDayquery] = useState('')
	const [pageNumber, setPageNumber] = useState(1)
	const pageSize = 10;

	const variables = {
		"ordersFirst": pageSize,
		"sortKey": "PROCESSED_AT",
		"reverse": sort,
		"query": query + ' ' + tabquery + ' ' + dayquery + customerDateQuery + orderQuery,
	}

	const func = (orders) => {
		let data = []
		data = orders.edges.map(t => {
			const order = {}
			order.id = t.node.id + '#' + t.node.fulfillmentOrders.edges[0].node.id
			const node = {}
			node.name = t.node.name
			node.customerName = t.node.customer == null ? '' : t.node.customer.firstName + ' ' + t.node.customer.lastName
			node.processedAt = t.node.processedAt
			node.tags = t.node.tags
			node.status = t.node.displayFulfillmentStatus
			node.financialStatus = t.node.displayFinancialStatus
			node.total = t.node.currentTotalPriceSet.shopMoney.amount + currency[t.node.currentTotalPriceSet.shopMoney.currencyCode]
			node.moreQuantity = false;
			t.node.lineItems.nodes.map(t1 => {
				if (t1.quantity > 1) {
					node.moreQuantity = true;
				}
			})
			order.node = node
			return order
		})
		setOrdersList(data);
		setPageInfo(orders.pageInfo)
	}

	const reloadData = async () => {
		const response = await fetch("/api/ordersList", {
			method: "POST",
			body: JSON.stringify({ variables, createdAt: defaultPrevDate }),
			headers: { "Content-Type": "application/json" },
		});

		if (response.ok) {
			const res = await response.json()
			const orders = res.ordersList.body.data.orders;
			let pageSizeMax = 50
			setShopName(res.session.shop);
			setProCnt(res.proCnt);
			setComCnt(res.comCnt);
			setAllCnt(res.allCnt);
			setPageNumber(Math.ceil(res.allCnt / pageSizeMax));
			if (selectedTab == 0) setPageNumber(Math.ceil(res.allCnt / pageSizeMax));
			else if (selectedTab == 1) setPageNumber(Math.ceil(res.proCnt / pageSizeMax));
			else if (selectedTab == 2) setPageNumber(Math.ceil(res.comCnt / pageSizeMax));
			func(orders)
			setOriginOrdersList(orders.edges);
			setIsLoading(false);
		}
	}

	useEffect(async () => {
		setIsLoading(true);
		reloadData()
	}, [query, tabquery, dayquery, orderQuery, sort, customerDateQuery]);

	const [selectedItem, setSelectedItem] = useState('print_label');
	const [dateFilter, setDateFiler] = useState('');

	const handleSelectChange = useCallback((value) => setSelectedItem(value), []);

	const handleDateFilterChange = useCallback((value) => {
		setDateFiler(value)
		setDayquery(value)
	}, []);

	const handleSort = useCallback((value) => {
		setSort(value == 'true' ? true : false)
	}, []);

	const options = [
		{ label: 'Fulfillment', value: 'bulk_actions' },
		{ label: 'Print', value: 'print_label' },
	];

	const [searchValue, setSearchValue] = useState("");

	const handleSearchInputChange = (value) => {
		setQuery(value)
		setSearchValue(value)
	};

	const onSearch = async () => {

	}

	const [selectedChild, setSelectedChild] = useState([])
	const [htmlContent, setHtmlContent] = useState('')

	const ordersMarkup = ordersList?.length ? (
		<Card>
			<OrderIndex shopName={shopName} Orders={ordersList} tabIndex={selectedTab} loading={isLoading} onChildSelect={e => myFunc(e)} />
			<div style={{ display: 'flex', justifyContent: 'center', paddingTop: 25, paddingBottom: 25 }}>
				<Pagination
					label={pageNumber}
					hasPrevious={pageInfo?.hasPreviousPage}
					onPrevious={async () => {
						setIsLoading(true);
						// pageNumber = pageNumber - 1;

						setPrePageInfo({});
						setNextPageInfo(pageInfo);

						const variables = {
							ordersLast: pageSize,
							before: pageInfo.startCursor,
							sortKey: "PROCESSED_AT",
							query: query + ' ' + tabquery + ' ' + dayquery + customerDateQuery + orderQuery,
							reverse: sort,
						}

						const response = await fetch("/api/ordersList", {
							method: "POST",
							body: JSON.stringify({ variables }),
							headers: { "Content-Type": "application/json" },
						});

						if (response.ok) {
							const res = await response.json()
							func(res.ordersList.body.data.orders)
							setIsLoading(false);
						}
					}}

					hasNext={pageInfo?.hasNextPage}
					onNext={async () => {
						setIsLoading(true);
						// pageNumber = pageNumber + 1;

						setPrePageInfo(pageInfo);
						setNextPageInfo({});

						const variables = {
							ordersFirst: pageSize,
							after: pageInfo.endCursor,
							sortKey: "PROCESSED_AT",
							query: query + ' ' + tabquery + ' ' + dayquery + customerDateQuery + orderQuery,
							reverse: sort,
						}
						const response = await fetch("/api/ordersList", {
							method: "POST",
							body: JSON.stringify({ variables }),
							headers: { "Content-Type": "application/json" },
						});

						if (response.ok) {
							setIsLoading(false);
							const res = await response.json()
							func(res.ordersList.body.data.orders)
						}

					}}
				/>
			</div>
		</Card>
	) : null;
	const myFunc = (val) => {
		setSelectedChild(val);
	}

	const [printFlag, setPrintFlag] = useState(false);
	const [printOrders, setPrintOrders] = useState([]);

	const printLabel = async (ids) => {
		const selIds = []
		const fulfillmentIds = []
		await ids.map(async t => {
			let isCargo = false
			const t1 = t.split("#")
			const arr = t1[0].split("/")
			const id = arr[arr.length - 1]
			selIds.push({ id })
			fulfillmentIds.push(t1[1])
		})
		selIds.sort(function(a, b){ if (a < b) return -1; if (a > b) return 1; return 0; });
		if (selIds.length === 0) alert('No items to apply!')
		else {
			setIsLoading(true);
			if (selectedItem == 'print_label') {
				let printOrders = [];
				for (let i = 0; i < selIds.length; i++) {
					for (let j = 0; j < originOrdersList.length; j++) {
						if (originOrdersList[j].node.id.indexOf('Order/' + selIds[i].id) > -1) {
							printOrders.push(originOrdersList[j].node);
							break;
						}
					}
				}
				setPrintOrders(printOrders);

				let win = window.open("https://print-app.fly.dev/print_label.html", "_blank");
				const response = await fetch("/api/printLabel", {
					method: "POST",
					body: JSON.stringify({ selIds }),
					headers: { "Content-Type": "application/json" },
				});
				if (response.ok) {
					const res = await response.json();
					const content = res.content;
					win.document.write(content);

					let variables = {};
					if (Object.keys(prePageInfo).length === 0 && Object.keys(nextPageInfo).length === 0) {
						variables = {
							ordersFirst: pageSize,
							sortKey: "PROCESSED_AT",
							query: query + ' ' + tabquery + ' ' + dayquery + customerDateQuery + orderQuery,
							reverse: sort,
						}
					} else if (Object.keys(prePageInfo).length !== 0 && Object.keys(nextPageInfo).length === 0) {
						variables = {
							ordersFirst: pageSize,
							after: prePageInfo.endCursor,
							sortKey: "PROCESSED_AT",
							query: query + ' ' + tabquery + ' ' + dayquery + customerDateQuery + orderQuery,
							reverse: sort,
						}
					} else if (Object.keys(prePageInfo).length === 0 && Object.keys(nextPageInfo).length !== 0) {
						variables = {
							ordersLast: pageSize,
							before: nextPageInfo.startCursor,
							sortKey: "PROCESSED_AT",
							query: query + ' ' + tabquery + ' ' + dayquery + customerDateQuery + orderQuery,
							reverse: sort,
						}
					}
					
					const response_1 = await fetch("/api/ordersList", {
						method: "POST",
						body: JSON.stringify({ variables }),
						headers: { "Content-Type": "application/json" },
					});

					if (response_1.ok) {
						setIsLoading(false);
						const res_1 = await response_1.json()
						func(res_1.ordersList.body.data.orders)
					}
				}
			}
			else {
				const response = await fetch("/api/fulfillmentOrders", {
					method: "POST",
					body: JSON.stringify({ fulfillmentIds }),
					headers: { "Content-Type": "application/json" },
				});
				if (response.ok) {
					await reloadData()
					setIsLoading(false);
				}
			}
		}
	}

	const toUtf8 = function (text) {
		var surrogate = encodeURIComponent(text);
		var result = '';
		for (var i = 0; i < surrogate.length;) {
			var character = surrogate[i];
			i += 1;
			if (character == '%') {
				var hex = surrogate.substring(i, i += 2);
				if (hex) {
					result += String.fromCharCode(parseInt(hex, 16));
				}
			} else {
				result += character;
			}
		}
		return result;
	};

	useEffect(() => {
		if (printFlag === true) {
			// window.open("https://23628504d8ad.eu.ngrok.io/print_label.html?content="+JSON.stringify({printOrders}), "_blank");
			setPrintFlag(false);
		}
	}, [printFlag])

	const [searchParams, setSearchParams] = useSearchParams();

	useEffect(async () => {

		let ids = [];
		let id = searchParams.get("id");
		if (id != null) {
			ids.push(id)
			printLabel(ids);
		}
		let url = searchParams.toString();
		let regex = /ids%5B%5D/gi, result, startIndices = [], lastIndices = [];
		if (url.indexOf("ids%5B%5D") > -1) {
			while ((result = regex.exec(url))) {
				startIndices.push(result.index + 10);
				lastIndices.push(url.indexOf("&", result.index));
			}
			for (let i = 0; i < startIndices.length; i++) {
				ids.push(url.substr(startIndices[i], lastIndices[i] - startIndices[i]));
			}
			printLabel(ids);
		}
	}, []);

	/* loadingMarkup uses the loading component from AppBridge and components from Polaris  */
	const loadingMarkup = isLoading ? (
		<Card sectioned>
			<Spinner accessibilityLabel="Spinner example" size="large" />
		</Card>
	) : null;

	/* Use Polaris Card and EmptyState components to define the contents of the empty state */
	const emptyStateMarkup =
		!isLoading && !ordersList.length ? (
			<Card sectioned>
				<EmptyState
					heading="No orders found"
					image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
				>
				</EmptyState>
			</Card>
		) : null

	return (
		<Page fullWidth={true}>
			<div style={{ backgroundColor: 'white' }}>
				<TitleBar
					title="Orders"
					primaryAction={{
						content: "Report",
						onAction: () => navigate("/report")
					}}
				/>
				<Loading />
				<Layout>
					<Layout.Section>
						<div style={{ display: 'flex', marginRight: 15 }}>
							<div style={{ height: 50, paddingLeft: 15}}>
								<TextField
									value={searchValue}
									labelHidden
									type="text"
									onChange={handleSearchInputChange}
									prefix={<Icon source={SearchMinor} color="inkLightest" />}
									placeholder="Search"
									maxHeight={100}
								/>
							</div>
							<div style={{ marginLeft: 20, paddingTop: 7 }}>
								Search date
							</div>
							<div style={{ marginLeft: 15, width: 140 }}>
								<Select
									options={[
										{ label: '', value: '' },
										{ label: 'Today', value: 'processed_at:\"past_day\"' },
										{ label: 'Last 7 days', value: 'processed_at:\"past_week\"' },
										{ label: 'Last 30 days', value: 'processed_at:\"past_month\"' },
										{ label: 'Last 90 days', value: 'processed_at:\"past_quarter\"' },
										{ label: 'Last 12 months', value: 'processed_at:\"past_year\"' },
									]}
									onChange={handleDateFilterChange}
									value={dateFilter}
								/>
							</div>
						</div>
						<div style={{ display: 'flex', marginRight: 15 }}>
							<div style={{ marginTop: 7, paddingLeft: 15, paddingRight: 15 }}>Order number </div>
							<div style={{ width: 130 }}>
								<TextField
									placeholder=""
									value={startOrderNumber}
									onChange={e => {
										setStartOrderNumber(e)
									}}
									autoComplete="off"
								/>
							</div>
							<div style={{ marginTop: 7, marginLeft: 10, marginRight: 10 }}>~</div>
							<div style={{ width: 130 }}>
								<TextField
									placeholder=""
									value={endOrderNumber}
									onChange={e => {
										setEndOrderNumber(e)
									}}
									autoComplete="off"
								/>
							</div>
							<div style={{ height: 50, paddingLeft: 15 }}>
								<Button onClick={async () => {
									let str = 'name:' + startOrderNumber, start = 0, end = 50000;
									if (startOrderNumber != "" && endOrderNumber == "") { start = parseInt(startOrderNumber); end = parseInt(startOrderNumber) + 500; }
									else if (startOrderNumber == "" && endOrderNumber != "") { start = parseInt(endOrderNumber) - 500 > 0 ? parseInt(endOrderNumber) - 500 : 0; end = parseInt(endOrderNumber); }
									else if (startOrderNumber != "" && endOrderNumber != "") { start = parseInt(startOrderNumber); end = parseInt(endOrderNumber); }
									for (let i = parseInt(start) + 1; i < parseInt(end) + 1; i++) {
										str = str + ' OR name:' + i;
									}
									setOrderQuery(str);
									if (startOrderNumber == "" && endOrderNumber == "") setOrderQuery("");
								}}>
									<div style={{ color: '#2271b1', fontSize: 14 }}>
										סנן
									</div>
								</Button>
							</div>
						</div>
						<div style={{ display: 'flex', marginRight: 15 }}>
							<div style={{ marginTop: 7, paddingLeft: 15, paddingRight: 15 }}>Customer Date </div>
							<div style={{ width: 130 }}>
								<TextField
									placeholder="YYYY-MM-DD"
									value={startCustomerDate}
									onChange={e => {
										setStartCustomerDate(e)
									}}
									autoComplete="off"
								/>
							</div>
							<div style={{ marginTop: 7, marginLeft: 10, marginRight: 10 }}>~</div>
							<div style={{ width: 130 }}>
								<TextField
									placeholder="YYYY-MM-DD"
									value={endCustomerDate}
									onChange={e => {
										setEndCustomerDate(e)
									}}
									autoComplete="off"
								/>
							</div>
							<div style={{ height: 50, paddingLeft: 15 }}>
								<Button onClick={async () => {
									let query = "";
									let date = new Date(new Date(new Date(endCustomerDate).setTime(new Date(endCustomerDate).getTime() + 86400000)).toString());
									let dd = date.getDate();
									let mm = date.getMonth()+1; 
									let yyyy = date.getFullYear();
									if(dd<10) 
									{
										dd='0'+dd;
									} 
									if(mm<10) 
									{
										mm='0'+mm;
									}
									let nextDate = yyyy + "-" + mm + "-" + dd;
									if (startCustomerDate != "") {
										query = " created_at:>" + startCustomerDate;
									}
									if (endCustomerDate != "") {
										query = " created_at:<" + nextDate;
									}
									if (startCustomerDate != "" && endCustomerDate != "") {
										query = " created_at:>" + startCustomerDate + " AND " + "created_at:<" + nextDate;
									}
									setCustomerDateQuery(query);
								}}>
									<div style={{ color: '#2271b1', fontSize: 14 }}>
										סנן
									</div>
								</Button>
							</div>
							{/* <div style={{ marginTop: 7, paddingLeft: 30, paddingRight: 15 }}>Phone Number: </div>
							<div style={{ width: 130 }}>
								<TextField
									placeholder=""
									value={phoneNumber}
									onChange={e => {
										setPhoneNumber(e)
									}}
									autoComplete="off"
								/>
							</div>
							<div style={{ height: 50, paddingLeft: 15 }}>
								<Button onClick={ async ()=>{
									setIsLoading(true);
									const variables = {
										ordersLast: 10,
										sortKey: "ID",
										query: query + ' ' + tabquery + ' ' + dayquery + orderQuery,
										reverse: true,
									}
									const response = await fetch("/api/phoneSearch", {
										method: "POST",
										body: JSON.stringify({ variables, phone: phoneNumber }),
										headers: { "Content-Type": "application/json" },
									});
			
									if (response.ok) {
										const res = await response.json()
										func(res.body.data.orders)
										setIsLoading(false);
									}
								}}>
									<div style={{ color: '#2271b1', fontSize: 14 }}>
									סנן	
									</div>
								</Button>
							</div> */}
						</div>
						<div style={{ display: 'flex', marginRight: 15 }}>
							<div style={{ width: 200, paddingLeft: 15 }}>
								<Select
									options={options}
									onChange={handleSelectChange}
									value={selectedItem}
								/>
							</div>
							<div style={{ height: 50, paddingLeft: 15 }}>
								<Button onClick={() => { printLabel(selectedChild) }}>
									<span style={{ color: '#2271b1', fontSize: 14 }}>Apply</span>
								</Button>
							</div>
							<div style={{ marginLeft: 20, paddingTop: 7 }}>
								Sort
							</div>
							<div style={{ marginLeft: 15, width: 140 }}>
								<Select
									options={[
										{ label: 'Oldest to newest', value: false },
										{ label: 'Newest to oldest', value: true },
									]}
									onChange={handleSort}
									value={sort}
								/>
							</div>
						</div>
					</Layout.Section>
					<Layout.Section>
						<Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />
					</Layout.Section>
					<Layout.Section>
						{loadingMarkup}
						{!isLoading && ordersMarkup}
						{emptyStateMarkup}
					</Layout.Section>
				</Layout>
			</div>
		</Page>
	)
}









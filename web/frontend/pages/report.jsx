import { useNavigate, TitleBar, Loading } from '@shopify/app-bridge-react';
import { useEffect } from 'react';
import {
	Card,
	EmptyState,
	Layout,
	Page,
	SkeletonBodyText,
	Tabs,
	Select,
	Button,
	TextStyle,
	Icon,
	TextField,
	Pagination,
	DatePicker,
	Popover,
} from "@shopify/polaris";
import FileSaver from 'file-saver';

import { ReportTable } from "../components";
import { useAuthenticatedFetch, useAppQuery } from "../hooks";

import { useState, useCallback } from 'react';
import { OrderStatusMinor } from '@shopify/polaris-icons';

export default function ReportPage() {
	/*
		Add an App Bridge useNavigate hook to set up the navigate function.
		This function modifies the top-level browser URL so that you can
		navigate within the embedded app and keep the browser in sync on reload.
	*/
	const navigate = useNavigate();
	const fetch = useAuthenticatedFetch();

	const [selectedTab, setSelectedTab] = useState(0);

	const [isLoading, setIsLoading] = useState(false);
	const [isRefetching, setRefetching] = useState(false);
	const [ordersList, setOrdersList] = useState([])
	const [reportsList, setReportsList] = useState([])
	const [pageInfo, setPageInfo] = useState({})

	const pageSize = 10
	let query = "Cargo Tracking: fulfillment_status:\"unshipped\"";
	const [dateQuery, setDateQuery] = useState('');
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')
	const [orderQuery, setOrderQuery] = useState('')
	const [startOrderNumber, setStartOrderNumber] = useState('');
	const [endOrderNumber, setEndOrderNumber] = useState('');
	const variables = {
		"ordersFirst": pageSize,
		"sortKey": "ID",
		"reverse": false,
		"query": query + ' ' + orderQuery,
	}

	const func = (res) => {
		const data = [];
		res.map(ordersList => {
			ordersList.body.data.orders.edges.map(t => {
				let cargoN
				t.node.tags.map(t => {
					if (t.indexOf('Cargo') > -1) cargoN = t.split(':')[1]
				})
				t.node.lineItems.nodes.map((t1, index) => {
					const order = {}
					order.id = t.node.id + "_" + index
					order.title = t1.name
					order.variant = t1.variantTitle
					order.orderNumber = t.node.name

					order.quantity = t1.quantity
					order.pricePerUnit = t1.variant ? t1.variant.price : ''
					order.shippingNumber = cargoN
					data.push(order);
				})
			})
		})
		
		setReportsList(data);
		integrateReport(data);
		
		// setPageInfo(ordersList[0].pageInfo)
	}

	const integrateReport = async (data) => {
		data.sort(function(a, b){ if (a.title < b.title) return -1; if (a.title > b.title) return 1; return 0; });

		let data1 = [];
		if (data.length > 0) {
			let report = {
				id: data[0].id,
				title: data[0].title,
				variant: data[0].variant,
				orderNumber: data[0].orderNumber,
				quantity: data[0].quantity,
				pricePerUnit: data[0].pricePerUnit,
				shippingNumber: data[0].shippingNumber,
			};
			let quantity = data[0].quantity;
			for (let i = 1; i < data.length; i++) {
				if (report.title == data[i].title) {
				quantity = quantity + data[i].quantity;
				report.quantity = 0;
				} else {
				report.quantity = quantity;
				quantity = data[i].quantity;
				data1.push(report);
				}
				report = {
					id: data[i].id,
					title: data[i].title,
					variant: data[i].variant,
					orderNumber: data[i].orderNumber,
					quantity: quantity,
					pricePerUnit: data[i].pricePerUnit,
					shippingNumber: data[i].shippingNumber,
				};
			}
			data1.push(report);
		}

		setOrdersList(data1);
	}

	const filterReport = (reports) => {
		const data = []
		reports.map(report => {
			if (startOrderNumber == "") {
				if (endOrderNumber == "" || (Number(report.orderNumber.replace(/\D/g, "")) <= endOrderNumber && endOrderNumber != "")){
					data.push(report);
				}
			}
			else {
				if ((startOrderNumber <= Number(report.orderNumber.replace(/\D/g, "")) && endOrderNumber == "") || (startOrderNumber <= Number(report.orderNumber.replace(/\D/g, "")) && Number(report.orderNumber.replace(/\D/g, "")) <= endOrderNumber && endOrderNumber != "")) {
					data.push(report);
				}
			}
		});

		integrateReport(data);
	}

	// useEffect(async () => {
	// 	setIsLoading(true);
	// 	const response = await fetch("/api/reportsList", {
	// 		method: "POST",
	// 		body: JSON.stringify({ variables }),
	// 		headers: { "Content-Type": "application/json" },
	// 	});

	// 	if (response.ok) {
	// 		const res = await response.json()
	// 		// const ordersList = res.body.data.orders
	// 		func(res)
	// 		setIsLoading(false);
	// 	}
	// }, []);

	const tabs = [
		{
			id: 'all-orders-1',
			content: 'All',
			accessibilityLabel: 'All orders',
			panelID: 'all-orders-content-1',
		},
		{
			id: 'processing-orders-1',
			content: 'Processing',
			panelID: 'processing-orders-content-1',
		},
		{
			id: 'complete-orders-1',
			content: 'Complete',
			panelID: 'complete-orders-content-1',
		},
	];

	const reportTable = ordersList?.length ? (
		<Card>
			<ReportTable Orders={ordersList} loading={isRefetching} />
		</Card>
	) : null;

	

	/* loadingMarkup uses the loading component from AppBridge and components from Polaris  */
	const loadingMarkup = isLoading ? (
		<Card sectioned>
			<Loading />
			<SkeletonBodyText />
		</Card>
	) : null;

	/* Use Polaris Card and EmptyState components to define the contents of the empty state */
	const emptyStateMarkup =
		!isLoading && !ordersList?.length ? (
			<Card sectioned>
				<EmptyState
					heading="No reports found"
					image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
				>
				</EmptyState>
			</Card>
		) : null;

	const [popoverActive1, setPopoverActive1] = useState(false);
	const [popoverActive2, setPopoverActive2] = useState(false);
	const togglePopoverActive1 = useCallback(
		() => setPopoverActive1((popoverActive) => !popoverActive),
		[],
	);
	const togglePopoverActive2 = useCallback(
		() => setPopoverActive2((popoverActive) => !popoverActive),
		[],
	);
	
	const [{month, year}, setDate] = useState({month: new Date().getMonth(), year: new Date().getFullYear()});
	const [selectedDates, setSelectedDates] = useState({
		start: new Date(),
    	end: new Date(),
	});

	const handleMonthChange = useCallback(
		(month, year) => setDate({month, year}),
		[],
	);

	const [{month1, year1}, setDate1] = useState({month1: new Date().getMonth(), year1: new Date().getFullYear()});
	const [selectedDates1, setSelectedDates1] = useState({
		start: new Date(),
    	end: new Date(),
	});

	const handleMonthChange1 = useCallback(
		(month, year) => setDate1({month, year}),
		[],
	);

	const activator1 = (
		<TextField onFocus={setPopoverActive1}
			placeholder="YYYY-MM-DD"
			value={startDate}
			onChange={e => setStartDate(e)}
			autoComplete="off"
		/>
	);
	const activator2 = (
		<TextField onFocus={togglePopoverActive2}
			placeholder="YYYY-MM-DD"
			value={endDate}
			onChange={e => setEndDate(e)}
			autoComplete="off"
		/>
	);
	return (
		<Page fullWidth={true}>
			<div style={{ backgroundColor: 'white' }}>
				<TitleBar
					title='דו"ח ליקוט'
					primaryAction={{
						content: "Order",
						onAction: () => navigate("/")
					}}
				/>
				<Layout>
					<Layout.Section>
						<div style={{ display: 'flex', marginRight: 15 }}>
							<div style={{ marginTop: 7, paddingLeft: 15, paddingRight: 15 }}>Order Number: </div>
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
							<div style={{ marginTop: 7 }}>~</div>
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
								<Button onClick={ async ()=>{
									// filterReport(reportsList)
									let str = 'name:' + startOrderNumber, start = 0, end = 50000;
									if (startOrderNumber != "" && endOrderNumber == "") { start = parseInt(startOrderNumber); end = parseInt(startOrderNumber) + 500; }
									else if (startOrderNumber == "" && endOrderNumber != "") { start = parseInt(endOrderNumber) - 500 > 0 ? parseInt(endOrderNumber) - 500 : 0; end = parseInt(endOrderNumber); }
									else if (startOrderNumber != "" && endOrderNumber != "") { start = parseInt(startOrderNumber); end = parseInt(endOrderNumber); }
									for (let i = parseInt(start) + 1; i < parseInt(end) + 1; i++) {
										str = str + ' OR name:' + i;
									}
									if (startOrderNumber == "" && endOrderNumber == "") str = "";
									
									setOrderQuery(str);
									if (str !="") {
										setIsLoading(true);
										let variables = {
											"ordersFirst": pageSize,
											"sortKey": "ID",
											"reverse": false,
											"query": query + ' ' + str,
										}
										const response = await fetch("/api/reportsList", {
											method: "POST",
											body: JSON.stringify({ variables }),
											headers: { "Content-Type": "application/json" },
										});

										if (response.ok) {
											const res = await response.json()
											// const ordersList = res.body.data.orders
											func(res)
											setIsLoading(false);
										}
									}
								}}>
									<div style={{ color: '#2271b1', fontSize: 14 }}>
									סנן	
									</div>
								</Button>
							</div>
							<div style={{ height: 50, paddingLeft: 15 }}>
								<Button onClick={ async ()=>{
									setIsLoading(true)
									const response = await fetch("/api/downloadExcel", {
										method: "POST",
										body: JSON.stringify({ variables, start: startOrderNumber, end: endOrderNumber }),
										headers: { "Content-Type": "application/json" },
									});

									const data = await response.arrayBuffer();
									const filename = `${Date.now()}.xlsx`;
																
									var blob = new Blob([new Uint8Array(data)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
									FileSaver.saveAs(blob, filename);
									setIsLoading(false)

								}}>
									<div style={{ color: '#2271b1', fontSize: 14 }}>
									הורדת דו"ח לקובץ
									</div>
								</Button>
							</div>
						</div>
					</Layout.Section>
					<Layout.Section>
						{loadingMarkup}
						{!isLoading && reportTable}
						{emptyStateMarkup}
					</Layout.Section>
				</Layout>
			</div>
		</Page>
	)
}
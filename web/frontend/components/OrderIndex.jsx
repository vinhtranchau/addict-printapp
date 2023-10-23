import styles from "../assets/style.css";
import { useNavigate } from "@shopify/app-bridge-react";
import {
  Card,
  IndexTable,
  Stack,
  TextStyle,
  UnstyledLink,
  useIndexResourceState,
  Button,
  Link,
} from "@shopify/polaris";

/* useMedia is used to support multiple screen sizes */
import { useMedia } from "@shopify/react-hooks";

/* dayjs is used to capture and format the date a QR code was created or modified */
import dayjs from "dayjs";

/* Markup for small screen sizes (mobile) */
function SmallScreenCard({
  id,
  node
}) {
  let cargo
  let isInvolveCargo = false
  let cargoN
  node.tags.map(t => {
    if (t.indexOf('Cargo') > -1) {
      isInvolveCargo = true
      cargoN = t.split(':')[1]
    }
  })

  if (!isInvolveCargo) cargo = 'אין משלוחים להצגה'
  else cargo = <div>
    מספר משלוח: <br />
    <div style={{ fontWeight: "bold", color: '#0066FF', marginBottom: 4 }}>{cargoN}</div>
  </div>
  return (
    <UnstyledLink onClick={() => {}}>
      <div
        style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E1E3E5" }}
      >
        <Stack>
          {/* <Stack.Item>
            <Thumbnail
              source={product?.images?.edges[0]?.node?.url || ImageMajor}
              alt="placeholder"
              color="base"
              size="small"
            />
          </Stack.Item> */}
          <Stack.Item fill>
            <Stack vertical={true}>
              <Stack.Item>
                <p className="mobile-item">
                  <TextStyle variation="strong">
                    {truncate(node.name, 35)}
                    </TextStyle>
                </p>
                <p className="mobile-item">{truncate(node.customerName)}<b>{" :CustomerName"}</b></p>
                <p className="mobile-item">{dayjs(node.processedAt).format("dddd") + " at " + dayjs(node.processedAt).format("h:mm a")}<b>{" :Date"}</b></p>
                <p className="mobile-item">{node.status == 'UNFULFILLED' && node.financialStatus == "PAID" ? 
                    <div style={{ display: 'inline', backgroundColor: "#019bab", fontSize: 13, textAlign: 'center', borderRadius: 3, paddingTop: 5, paddingLeft: 10, paddingRight: 10, paddingBottom: 5, color: 'white' }}>
                      processing              
                    </div> : <div style={{ display: 'inline', backgroundColor: "#c8e3ca", fontSize: 13, textAlign: 'center', borderRadius: 3, paddingTop: 5, paddingLeft: 10, paddingRight: 10, paddingBottom: 5, color: '#5f8147' }}>
                      Fulfillment
                    </div>}<b>{" :Status"}</b>
                  </p>
                <p className="mobile-item">{node.total}<b>{" :Total"}</b></p>
                <p className="mobile-item">{cargo}</p>
                <p className="mobile-item">{node.moreQuantity && <div style={{backgroundColor: 'red', color: 'white', textAlign: 'center'}}>הזמנה מעל פריט 1</div>}</p>
              </Stack.Item>
            </Stack>
          </Stack.Item>
        </Stack>
      </div>
    </UnstyledLink>
  );
}

export function OrderIndex({ shopName, Orders, tabIndex, loading, onChildSelect }) {
  const navigate = useNavigate();

  /* Check if screen is small */
  const isSmallScreen = useMedia("(max-width: 640px)");

  const smallScreenMarkup = Orders.map((Order) => (
    <SmallScreenCard key={Order.id} navigate={navigate} {...Order} />
  ));

  const resourceName = {
    singular: "order",
    plural: "Orders",
  };

  const {selectedResources, allResourcesSelected, handleSelectionChange} = useIndexResourceState(Orders);

  const rowMarkup = Orders.map(
    ({ id, node }, index) => {
      let cargo
      let isInvolveCargo = false
      let cargoN
      node.tags.map(t => {
        if (t.indexOf('Cargo') > -1) {
          isInvolveCargo = true
          cargoN = t.split(':')[1]
        }
      })

      if (!isInvolveCargo) cargo = 'אין משלוחים להצגה'
      else cargo = <div>
        מספר משלוח: <br />
        <div style={{ fontWeight: "bold", color: '#0066FF', marginBottom: 4 }}>{cargoN}</div>
      </div>
      return (
        <IndexTable.Row
          id={id}
          key={id}
          selected={selectedResources.includes(id)}
          // && !(node.status == "FULFILLED" && !isInvolveCargo)
          position={index}
          // disabled={node.status == "FULFILLED" && !isInvolveCargo ? true : false}
        >
          <IndexTable.Cell>
            <Button 
              plain 
              onClick={() => {
              navigate("https://" + shopName + "/admin/orders/" + id?.slice(20, id?.length));
            }}>
              {truncate(node.name, 25)}
            </Button>
          </IndexTable.Cell>
          <IndexTable.Cell>
              {truncate(node.customerName)}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {dayjs(node.processedAt).format("dddd") + " at " + dayjs(node.processedAt).format("h:mm a")}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {node.status == 'UNFULFILLED' && node.financialStatus == "PAID" ? 
              <div style={{ display: 'inline', backgroundColor: "#019bab", fontSize: 13, textAlign: 'center', borderRadius: 3, paddingTop: 5, paddingLeft: 10, paddingRight: 10, paddingBottom: 5, color: 'white' }}>
                processing              
              </div> : <div style={{ display: 'inline', backgroundColor: "#c8e3ca", fontSize: 13, textAlign: 'center', borderRadius: 3, paddingTop: 5, paddingLeft: 10, paddingRight: 10, paddingBottom: 5, color: '#5f8147' }}>
                Fulfillment
              </div>}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {node.total}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {cargo}
          </IndexTable.Cell>
          <IndexTable.Cell>
          {node.moreQuantity && <div style={{backgroundColor: 'red', color: 'white', textAlign: 'center'}}>הזמנה מעל פריט 1</div>}
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );
  /* A layout for small screens, built using Polaris components */
  return (
    <Card>
      {isSmallScreen ? (
        smallScreenMarkup
      ) : (
          <IndexTable
            resourceName={resourceName}
            itemCount={Orders.length}
            selectedItemsCount={
              allResourcesSelected ? 'All' : selectedResources.length
            }
            onSelectionChange={async (param1, param2, param3) => {
              handleSelectionChange(param1, param2, param3)
              if (param2) {
                if (param1 === 'single') {
                  const arr = [...selectedResources]
                  arr.push(param3)
                  onChildSelect(arr)
                } else if(param1 === 'page') {
                  // await Orders.map(async t => {
                  //   let cargoStatus = false;
                  //   await t.node.tags.map(t1 => {
                  //     if (t1.indexOf('Cargo') > -1) {
                  //       cargoStatus = true
                  //     }
                  //   })
                  //   if (t.node.status == "UNFULFILLED" || cargoStatus == true) selectedResources.push(t.id)
                  // })            
                  // onChildSelect(selectedResources)
                  
                  const arr = Orders.map(t => t.id)
                  onChildSelect(arr)
                }
              } else {
                if (param1 === 'single') {
                  const arr = [...selectedResources]
                  const index = arr.indexOf(param3);
                  if (index > -1) { // only splice array when item is found
                    arr.splice(index, 1); // 2nd parameter means remove one item only
                  }
                  onChildSelect(arr)
                } else if(param1 === 'page') {
                  onChildSelect([])
                }
              }
            }}
            headings={[
              { title: "Order"},
              { title: "CustomerName"},
              { title: "Date" },
              { title: "Status" },
              { title: "Total" },
              { title: "קרגו אקספרסס שליחויות" },
              { title: "כמות" },
            ]}
            loading={loading}
          >
            {rowMarkup}
          </IndexTable>
      )}
    </Card>
  );
}

/* A function to truncate long strings */
function truncate(str, n) {
  return str.length > n ? str.substr(0, n - 1) + "…" : str;
}

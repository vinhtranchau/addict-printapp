import styles from "../assets/style.css";
import { useNavigate } from "@shopify/app-bridge-react";
import {
  Card,
  IndexTable,
  Stack,
  TextStyle,
  UnstyledLink,
} from "@shopify/polaris";


/* useMedia is used to support multiple screen sizes */
import { useMedia } from "@shopify/react-hooks";

/* dayjs is used to capture and format the date a QR code was created or modified */
import dayjs from "dayjs";

/* Markup for small screen sizes (mobile) */
function SmallScreenCard({
  id, 
  title, 
  orderNumber, 
  quantity, 
  pricePerUnit, 
  shippingNumber
}) {
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
                <p className="mobile-item">{title}<b>{" :שם הפריט"}</b></p>
                <p className="mobile-item"><b>{"מספר הזמנה: "}</b>{orderNumber}</p>
                <p className="mobile-item"><b>{"כמות: "}</b>{quantity}</p>
                <p className="mobile-item"><b>{"מחיר ליחידה: "}</b>{pricePerUnit}</p>
                <p className="mobile-item"><b>{"מספר משלוח: "}</b>{shippingNumber}</p>
               </Stack.Item> 
            </Stack>
          </Stack.Item>
        </Stack>
      </div>
    </UnstyledLink>
  );
}

export function ReportTable({ Orders, loading }) {
  const navigate = useNavigate();

  /* Check if screen is small */
  const isSmallScreen = useMedia("(max-width: 640px)");

  const smallScreenMarkup = Orders.map((Order) => (
    <SmallScreenCard key={Order.id} navigate={navigate} {...Order} />
  ));

  const resourceName = {
    singular: "QR code",
    plural: "QR codes",
  };

  const rowMarkup = Orders.map(
    ({ id, title, orderNumber, quantity, pricePerUnit, shippingNumber }, index) => {
      /* The form layout, created using Polaris components. Includes the QR code data set above. */
      return (
        <IndexTable.Row
          id={id}
          key={id}
          position={index}
          onClick={() => {
            // navigate(`/qrcodes/${id}`);
          }}
        >
          <IndexTable.Cell>
            {title}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {orderNumber}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {quantity}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {pricePerUnit}
          </IndexTable.Cell>
          <IndexTable.Cell>
            {shippingNumber}
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
            headings={[
              { title: "שם הפריט" },
              { title: "מספר הזמנה" },
              { title: "כמות" },
              { title: "מחיר ליחידה" },
              { title: "מספר משלוח" },
            ]}
            loading={loading}
            selectable={false}
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

# Verified Assignment

#### Functions:

`createOrder`: creates an order, appends it to the DAG tree and broadcasts the event (BUY/SELL)

`broadcastBuy`: broadcasts a buy event, and subscribes the node to the sell event associated to that stock

`broadcastSell`: broadcasts a sell event, and subscribes the node to the buy event associated to that stock (otherwise we can't publish a buy event because there won't be enough subscribers)

`appendNode`: takes an order and appends it to the DAG tree

`extractObject`: takes a CID and extracts the content associated with it from the DAG tree

`filterNodes`: takes the last node CID, loops through the tree up to the root using the `previous` property of each node, and returns an array of nodes filtering out the order passed as a parameter

`constructTree`: builds the DAG tree from an array of nodes passed to it, and returns the CID of the last node in that tree

`printTree`: prints the whole DAG tree

`stringifyOrder`: returns a string representation of an order in the format `"stockName | price | quantity"`, making it easy to compare when filtering out orders

#### How it works ?

When an order is registered, the node subscribes to the opposite operation (if it was a buy, we subscribe to the sell operation. Vice versa). When the opposite operations match, they get printed on the console, and we filter out the orders' nodes from the tree, constructing a new tree.

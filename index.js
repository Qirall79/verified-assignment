import * as IPFS from "ipfs-core";
import { CID } from "multiformats/cid";

const node = await IPFS.create();
const merkleTree = node.dag;

// keep track of the latest node on the tree
let latestNodeCid = null;

// register subscribers
let subscribersCount = {};

// text encoder/decoder
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const createOrder = async (stock, price, quantity, operation) => {
  const order = {
    stock,
    price,
    quantity,
    previous: latestNodeCid,
  };

  try {
    const cid = await appendNode(order);
    latestNodeCid = cid;

    // handle stock buy
    if (operation === "BUY") {
      await broadcastBuy(order);
    }
    // handle stock sell
    else {
      await broadcastSell(order);
    }
  } catch (error) {
    console.log(error.message);
  }
};

const broadcastBuy = async (order) => {
  try {
    // only publish if there's a peer listening (otherwise we get an error)
    if (subscribersCount[`stock${order.stock}buy`]) {
      await node.pubsub.publish(
        `stock${order.stock}buy`,
        encoder.encode(stringifyOrder(order))
      );
    }

    const topic = `stock${order.stock}sell`;
    await node.pubsub.subscribe(topic, async ({ data }) => {
      console.log(`Matched stock${order.stock}buy and ${topic}`);

      latestNodeCid = await constructTree(
        await filterNodes(decoder.decode(data))
      );
      delete subscribersCount[topic];
    });

    // increment the subscriptions count for this topic
    if (!subscribersCount[topic]) {
      subscribersCount[topic] = 1;
    }
  } catch (error) {
    console.log(error.message);
  }
};

const broadcastSell = async (order) => {
  try {
    // only publish if there's a peer listening (otherwise we get an error)
    if (subscribersCount[`stock${order.stock}sell`]) {
      await node.pubsub.publish(
        `stock${order.stock}sell`,
        encoder.encode(stringifyOrder(order))
      );
    }

    const topic = `stock${order.stock}buy`;
    await node.pubsub.subscribe(topic, async ({ data }) => {
      console.log(`Matched stock${order.stock}sell and ${topic}`);

      latestNodeCid = await constructTree(
        await filterNodes(decoder.decode(data))
      );
      delete subscribersCount[topic];
    });

    // increment the subscriptions count for this topic
    if (subscribersCount[topic]) {
      subscribersCount[topic]++;
    } else {
      subscribersCount[topic] = 1;
    }
  } catch (error) {
    console.log(error.message);
  }
};

// extract original object from cid
const extractObject = async (cid) => {
  try {
    const cidNode = await merkleTree.get(cid);
    const cidDataString = decoder.decode(cidNode.value);
    const data = JSON.parse(cidDataString);
    return data;
  } catch (error) {
    console.log(error.message);
  }
};

// return a string version of an order
const stringifyOrder = (order) => {
  return `${order.stock} | ${order.price} | ${order.quantity}`;
};

// add node to the tree
const appendNode = async (order) => {
  try {
    const orderBuffer = Buffer.from(JSON.stringify(order));
    const cid = await merkleTree.put(orderBuffer);
    return cid;
  } catch (error) {
    console.log(error.message);
  }
};

// print the whole tree (it's going to be upside down, root at the bottom)
const printTree = async (prevCID = latestNodeCid, result = []) => {
  try {
    const order = await extractObject(prevCID);
    result.push(order.stock);
    if (!order.previous) {
      result = result.reverse();
      for (let stock of result) {
        console.log(stock);
        console.log("|");
      }
      return;
    }
    return await printTree(CID.parse(order.previous["/"]), result);
  } catch (error) {
    console.log(error.message);
  }
};

// return an array of nodes, removing the orders matched
const filterNodes = async (order) => {
  try {
    const filtered = [];
    let currentNode = await extractObject(latestNodeCid);
    while (currentNode.previous) {
      if (stringifyOrder(currentNode) !== order) {
        const { stock, price, quantity } = currentNode;
        filtered.push({ stock, price, quantity });
      }

      currentNode = await extractObject(CID.parse(currentNode.previous["/"]));
    }
    // add the root because it's not handled inside the loop
    if (stringifyOrder(currentNode) !== order) {
      const { stock, price, quantity } = currentNode;
      filtered.push({ stock, price, quantity });
    }

    return filtered;
  } catch (error) {
    console.log(error.message);
  }
};

const constructTree = async (nodes) => {
  try {
    // reset latestNodeCid
    latestNodeCid = null;

    // get last element of the nodes array (the root)
    const last = nodes.length - 1;

    for (let i = last; i >= 0; i--) {
      const cid = await appendNode({ ...nodes[i], previous: latestNodeCid });
      latestNodeCid = cid;
    }
    return latestNodeCid;
  } catch (error) {
    console.log(error.message);
  }
};

async function main() {
  // sample orders
  await createOrder("TSLA", 449, 3, "BUY");
  await createOrder("AAPL", 449, 3, "BUY");
  await createOrder("GOOGL", 449, 3, "BUY");
  await createOrder("AAPL", 449, 3, "SELL");
  await createOrder("NTFLX", 249, 7, "SELL");
  await createOrder("NTFLX", 249, 7, "BUY");
  await createOrder("TSLA", 449, 3, "SELL");
  node.stop();
}

main();

const fs = require('fs'),
    _ = require('lodash');

//Read flow json & call main() function for further processing.
function initFlowBreaker(startingVertex) {
    fs.readFile('./app/flow-source/flow2.json', (err, data) => {
        if (err) throw err;
        main(JSON.parse(data), startingVertex);
    });
}

function main(flow, startingVertex) {
    flow.discardedStates = { verticesRemoved: new Set(), stateTransactionRemoved: [] };
    if (flow && flow.states) {
        let verticesMap = {};
        flow.states.forEach(function (transaction, index) {
            initVerticesMap(verticesMap, transaction, index);
        });
        markNewFlow(flow, verticesMap, startingVertex);
        rearrangeVertexLinkage(flow, verticesMap);
        
        flow.startState = startingVertex;

        console.dir(flow, { depth: null });
        //console.dir(verticesMap, { depth: null });
    }

}


/* Logic
Translate the json schema into following object named as verticesMap
{
    `${states[<index>].name}` : {
            index             <-- Represents index at which given vertex present into the states[]
            isDescarded       <-- Represents whether or not given vertex is considered to be discarded.
            transitions       <-- Represents array of child vertices to whom given vertex is connected to. 
            parents           <-- Represents arrays of parent vertices of given vertex.
    }
}
Example: 
{
  customScan: {
    index: 0,
    isDescarded: 0,
    transitions: [ 'saveDataCheck' ],
    parents: []
  },
  saveDataCheck: {
    index: 1,
    isDescarded: 0,
    transitions: [ 'daxDataFetch' ],
    parents: [ 'customScan' ]
  },
  daxDataFetch: {
    index: 2,
    isDescarded: 0,
    transitions: [ '85cc7d97-3fc0-4946-b3eb-f2a207d3c8e2', 'finalA' ],
    parents: [ 'saveDataCheck' ]
  }
  .
  .
  .
}
*/
function initVerticesMap(verticesMap, transaction, index) {
    if (!verticesMap[`${transaction.name}`]) {
        verticesMap[`${transaction.name}`] = {
            index,
            isDescarded: 1,
            transitions: transaction.transitions.map(t => t.target),
            parents: transaction.parents
        }
    }
}

/* Logic
    - From new Start Point recursively go ahead to child vertices & clear isDescarded property against those vertices into the verticesMap.
*/
function markNewFlow(flow, verticesMap, currentVertex) {
    if (verticesMap[`${currentVertex}`].isDescarded) {
        verticesMap[`${currentVertex}`].isDescarded = 0;
        verticesMap[`${currentVertex}`].transitions.forEach(childVertex => {
            markNewFlow(flow, verticesMap, childVertex)
        });
    }
}

/* Logic
iterate over verticesMap sequentially
       - if the vertex isDescarded then
           - Iterate over all of its transactions
               - if any vertex is found to be NOT discarded then
                   - Remove that vertex from the transitions of discarded vertex.
                   - Also remove the discarded parent vertex from the parent property associated with the non discarded vertex.
*/
function rearrangeVertexLinkage(flow, verticesMap) {
    const newStates = [];
    Object.entries(verticesMap).forEach(entry => {
        const [currStateName, currStateTransaction] = entry;
        if (currStateTransaction.isDescarded) {
            if(!flow.discardedStates.verticesRemoved.has(currStateName)){
                flow.discardedStates.verticesRemoved.add(currStateName);
                flow.discardedStates.stateTransactionRemoved.push(flow.states[`${currStateTransaction.index}`]);
            }
        }else{
            //Not discared
            currStateTransaction.parents.forEach((parentStateName => {
                const parentTransaction = verticesMap[`${parentStateName}`];
                if (parentTransaction.isDescarded) {
                    _.remove(flow.states[`${parentTransaction.index}`].transitions, {target: currStateName});
                    flow.states[`${currStateTransaction.index}`].parents = _.without(flow.states[`${currStateTransaction.index}`].parents, parentStateName);
                }
            }));
            newStates.push(flow.states[`${currStateTransaction.index}`]);
        }
    });
    flow.states = newStates;
}

/*
    Here in this example, We want to re-arrange the flow considering the fact that '85cc7d97-3fc0-4946-b3eb-f2a207d3c8e2' 
    will be the new start point.
*/
initFlowBreaker('D');
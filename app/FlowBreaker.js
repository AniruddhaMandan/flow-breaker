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
    flow.discardedStates = {verticesRemoved:[], stateTransactionRemoved:[]};
    if (flow && flow.states) {
        let verticesMap = {};
        flow.states.forEach(function (transaction, index) {
            initVerticesMap(verticesMap, transaction, index);
        });
        discardParentVertices(flow, verticesMap, startingVertex);
        rearrangeVertexLinkage(flow, verticesMap);
        flow.startState = startingVertex;
        
        console.dir(flow, {depth:null});
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
function initVerticesMap(verticesMap, transaction, index){
    if(!verticesMap[`${transaction.name}`]){
        verticesMap[`${transaction.name}`] = {
            index,
            isDescarded: 0,
            transitions: transaction.transitions.map(t => t.target),
            parents: transaction.parents
        }
    }
}

/* Logic
    - From new Start Point recursively go back to parent & mark isDescarded property against those vertices into the verticesMap as 1.
    - Simultaneously keep accumulating discarded vertices into a seperate list.
*/
function discardParentVertices(flow, verticesMap, startingVertex){
    verticesMap[`${startingVertex}`].parents.forEach(parentVertex =>{
        markVertexDiscarded(flow, verticesMap, parentVertex, startingVertex);
    });
}

function markVertexDiscarded(flow, verticesMap, currVertex, startingVertex){
    let transaction = verticesMap[`${currVertex}`];
    if(transaction){
        if(!flow.discardedStates.verticesRemoved.includes(currVertex)){
            flow.discardedStates.verticesRemoved.push(currVertex);
            flow.discardedStates.stateTransactionRemoved.push({
                ...flow.states[`${transaction.index}`]
            });
        }
        transaction.isDescarded = 1;

        transaction.parents.forEach(parentVertex =>{
            if(parentVertex !== startingVertex){
                markVertexDiscarded(flow, verticesMap, parentVertex, startingVertex);
            }
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
function rearrangeVertexLinkage(flow, verticesMap){
    Object.entries(verticesMap).forEach(entry => {
        const [currStateName, currStateTransaction] = entry;
            if(currStateTransaction.isDescarded){
                currStateTransaction.transitions.forEach((childStateName =>{
                    const childTransaction = verticesMap[`${childStateName}`];
                    if(!childTransaction.isDescarded){
                        //remove vertex from the transitions of "discarded vertex" i.e. currStateTransaction
                        _.remove(flow.states[`${currStateTransaction.index}`].transitions, {target: childStateName});
                        
                        //Also remove the discarded parent vertex from the parent property associated with the non discarded vertex.
                        flow.states[`${childTransaction.index}`].parents = _.without(flow.states[`${childTransaction.index}`].parents, currStateName);
                    }
                }));
            }
      });  
}

/*
    Here in this example, We want to re-arrange the flow considering the fact that '85cc7d97-3fc0-4946-b3eb-f2a207d3c8e2' 
    will be the new start point.
*/
initFlowBreaker('I');

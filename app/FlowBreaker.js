const fs = require('fs'),
_ = require('lodash');

//Read flow json & call main() function for further processing.
function initFlowBreaker(startingVertex) {
    fs.readFile('./app/flow-source/flow1.json', (err, data) => {
        if (err) throw err;
        main(JSON.parse(data), startingVertex);
    });
}

function main(flow, startingVertex) {
    flow.discardedTransactions = [];
    if (flow && flow.states) {
        let verticesMap = {};
        flow.states.forEach(function (transaction, index) {
            initVerticesMap(verticesMap, transaction, index);
        });
        discardParentVertices(flow, verticesMap, verticesMap[`${startingVertex}`], startingVertex);
        rearrangeVertexLinkage(flow, verticesMap);
        flow.startState = startingVertex;
        
        console.log(JSON.stringify(flow));
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
function discardParentVertices(flow, verticesMap, transaction, newStartingVertex){
    if(transaction.parents && transaction.parents.length !== 0){
        transaction.parents.forEach(parentVertex =>{
            if(parentVertex == newStartingVertex){
                const errorMsg = `${newStartingVertex} is found to be one of the discarded vertices & hence it cant be set as a new start point...!`;
                throw new Error(errorMsg);
            }
            flow.discardedTransactions.push({
                ...flow.states[`${verticesMap[`${parentVertex}`].index}`]
            });
            verticesMap[`${parentVertex}`].isDescarded = 1;
            discardParentVertices(flow, verticesMap, verticesMap[`${parentVertex}`], newStartingVertex);
        })
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
        const [parentVertexName, parentTransaction] = entry;
            if(parentTransaction.isDescarded){
                const parentVertexFlow = flow.states[`${parentTransaction.index}`];
                parentTransaction.transitions.forEach((childVertex =>{
                    const childTransaction = verticesMap[`${childVertex}`];
                    if(!childTransaction.isDescarded){
                        //remove vertex from the transitions of "discarded vertex" i.e. parentTransaction
                        parentVertexFlow.transitions = _.remove(parentVertexFlow.transitions, {target: childVertex});
                        
                        //Also remove the discarded parent vertex from the parent property associated with the non discarded vertex.
                        const childVertexFlow = flow.states[`${childTransaction.index}`];
                        childVertexFlow.parents = _.without(childVertexFlow.parents, parentVertexName);
                    }
                }));
            }
      });  
}

/*
    Here in this example, We want to re-arrange the flow considering the fact that '85cc7d97-3fc0-4946-b3eb-f2a207d3c8e2' 
    will be the new start point.
*/
initFlowBreaker('85cc7d97-3fc0-4946-b3eb-f2a207d3c8e2');

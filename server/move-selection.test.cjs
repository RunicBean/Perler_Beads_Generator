const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/moveSelection.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2020,target:ts.ScriptTarget.ES2020}}).outputText;
const helpers=import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('rectangle isolates part of a connected pattern and preserves every unselected bead',async()=>{
 const {selectionBox,selectBoxCells,shiftCells,canShiftSelection}=await helpers;
 const cells=['a','b','c',null,null,null,null,null,null,null,null,'d'];
 const selected=selectBoxCells(cells,4,selectionBox(0,0,1,0,4,3));assert.deepEqual(selected,[0,1]);
 assert.equal(canShiftSelection(cells,4,3,0,1,selected),true);
 const next=shiftCells(cells,4,3,0,1,selected);
 assert.deepEqual(next,[null,null,'c',null,'a','b',null,null,null,null,null,'d']);assert.equal(cells[0],'a');
});
test('empty boxes never fall back to moving the whole layer',async()=>{
 const {selectBoxCells,selectionBox,shiftCells,clampShiftDelta}=await helpers;
 const cells=['a',null,null,null];const selected=selectBoxCells(cells,2,selectionBox(1,1,1,1,2,2));
 assert.deepEqual(selected,[]);assert.deepEqual(shiftCells(cells,2,2,1,0,selected),cells);assert.deepEqual(clampShiftDelta(cells,2,2,100,100,selected),{dx:0,dy:0});
 assert.deepEqual(shiftCells(cells,2,2,1,0),[null,'a',null,null]);
});
test('collision protection permits self-overlap but rejects occupied destinations',async()=>{
 const {canShiftSelection,shiftCells}=await helpers;
 const cells=['a','b',null,'c',null,null,null,null];
 assert.equal(canShiftSelection(cells,4,2,1,0,[0,1]),true);
 assert.deepEqual(shiftCells(cells,4,2,1,0,[0,1]),[null,'a','b','c',null,null,null,null]);
 assert.equal(canShiftSelection(cells,4,2,2,0,[0,1]),false);
 assert.equal(canShiftSelection(cells,4,2,-1,0,[0,1]),false);
});
test('reverse / off-board marquee and movement bounds keep all selected beads on the board',async()=>{
 const {selectionBox,translateBox,clampShiftDelta}=await helpers;
 assert.deepEqual(selectionBox(3,3,-10,1,4,4),{left:0,top:1,right:3,bottom:3});
 const box=selectionBox(0,0,1,1,4,4);assert.deepEqual(translateBox(box,2,1),{left:2,right:3,top:1,bottom:2});
 const cells=['a','b',null,null,null,null,null,null];assert.deepEqual(clampShiftDelta(cells,4,2,999,999,[0,1]),{dx:2,dy:1});
});

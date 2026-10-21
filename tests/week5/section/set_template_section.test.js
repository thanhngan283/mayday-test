
const request = require('supertest');
const app = require('../../../app');
const admin = 'token_1', patient = 'token_2', doctor = 'token_3';
function reset() {
  for (const key of ['users','templates','sections','questions','options','medical_records']) app.db[key].length = 0;
  app.db.blacklist.clear();
  app.db.users.push(
    {user_id:1,full_name:'Admin',phone:'0912345678',password:'password123',role_id:3,is_active:1},
    {user_id:2,full_name:'Patient',phone:'0988776655',password:'password123',role_id:1,is_active:1},
    {user_id:3,full_name:'Doctor',phone:'0977444555',password:'password123',role_id:2,is_active:1}
  );
  app.db.templates.push({code_template:'TMPL_TEST',name:'Template test',description:null,version:'1.0',is_active:'1',sections:[]});
}
function sectionFixture() {
  const row={section_id:1,template_id:'TMPL_TEST',title:'Section test',order:'1',is_required:'0',filled_by:'patient'};
  app.db.sections.push(row); app.db.templates[0].sections.push(row); return row;
}
function questionFixture(type='text', options=[]) {
  const s=app.db.sections.find(x=>x.section_id===1)||sectionFixture();
  const q={question_id:'Q_TEST',section_id:s.section_id,question_text:'Question test',type_question:type,order:'1',placeholder:null,is_required:'0',help_text:null,allow_image:'0',show_if_answer:null,trigger_image_upload:'0',parent_question_id:null,options:[]};
  app.db.questions.push(q);
  options.forEach((o,i)=>{const x={id:i+1,question_id:q.question_id,option_text:o.option_text,option_value:o.option_value,order:String(i+1),trigger_image_upload:'0'};app.db.options.push(x);q.options.push(x);});
  return q;
}
beforeEach(reset);

describe('W5 - POST /api/templates/:template_id/sections',()=>{
 const url='/api/templates/TMPL_TEST/sections';
 const good={title:'Symptoms',order:'1'};
 test('W5-SSC-01/02/03: creates with defaults and accepted filled_by values',async()=>{
  let r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(good);
  expect(r.status).toBe(201); expect(r.body.code).toBe('1001'); expect(r.body.data.is_required).toBe('0'); expect(r.body.data.filled_by).toBe('patient');
  for(const filled_by of ['doctor','patdoc']) {r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send({...good,title:'Title '+filled_by,order:'2',filled_by,is_required:'1'});expect(r.body.code).toBe('1001');}
 });
 test('W5-SSC-04/05: detail reflects new sections and duplicate order is allowed',async()=>{
  await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(good);
  await request(app).post(url).set('Authorization',`Bearer ${admin}`).send({...good,title:'Second'});
  const r=await request(app).get('/api/templates/TMPL_TEST').set('Authorization',`Bearer ${admin}`);
  expect(r.body.code).toBe('1000'); expect(r.body.data.sections).toHaveLength(2);
 });
 test.each([
  [{order:'1'},'2001'],[{title:'x'},'2001'],[{},'2001'],
  [{title:123,order:'1'},'2002'],[{title:'x',order:1},'2002'],
  [{title:'x',order:'1',is_required:1},'2002'],[{title:'x',order:'1',filled_by:1},'2002'],
  [{title:'   ',order:'1'},'2003'],[{title:'x'.repeat(201),order:'1'},'2003'],[{title:'<b>',order:'1'},'2003'],
  [{title:'x',order:'abc'},'2003'],[{title:'x',order:'-1'},'2003'],[{title:'x',order:'1.5'},'2003'],[{title:'x',order:'10000'},'2003'],
  [{title:'x',order:'1',is_required:'2'},'2003'],[{title:'x',order:'1',filled_by:'nurse'},'2003']
 ])('W5-SSC validation %#',async(body,code)=>{
  const r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(body); expect(r.body.code).toBe(code);
 });
 test('W5-SSC-13/14: missing template and malformed template code',async()=>{
  let r=await request(app).post('/api/templates/TMPL_NOT_EXIST/sections').set('Authorization',`Bearer ${admin}`).send(good);expect(r.body.code).toBe('3401');
  r=await request(app).post('/api/templates/abc%20def/sections').set('Authorization',`Bearer ${admin}`).send(good);expect(r.body.code).toBe('2003');
 });
 test('W5-SSC-15: cannot add section to template already used by a medical record',async()=>{
  app.db.medical_records.push({code_template:'TMPL_TEST'});
  const r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(good);expect(r.body.code).toBe('3407');
 });
 test('W5-SSC-17/18/19/20/21/22: auth and permission',async()=>{
  let r=await request(app).post(url).send(good);expect(r.body.code).toBe('3003');
  r=await request(app).post(url).set('Authorization','Bearer abc').send(good);expect(r.body.code).toBe('3001');
  r=await request(app).post(url).set('Authorization','Bearer expired_token_mock').send(good);expect(r.body.code).toBe('3002');
  app.db.blacklist.add('token_1');r=await request(app).post(url).set('Authorization','Bearer token_1').send(good);expect(r.body.code).toBe('3001');
  r=await request(app).post(url).set('Authorization',`Bearer ${patient}`).send(good);expect(r.body.code).toBe('3102');
  r=await request(app).post(url).set('Authorization',`Bearer ${doctor}`).send(good);expect(r.body.code).toBe('3102');
 });
});

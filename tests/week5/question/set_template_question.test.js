
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

describe('W5 - POST /api/templates/sections/:section_id/questions',()=>{
 const url='/api/templates/sections/1/questions';
 const good={question_id:'Q_ITCH',question_text:'Do you have pain?',type_question:'text',order:'1'};
 beforeEach(()=>sectionFixture());
 test('W5-SQC-01/02/04/05: creates supported question types and defaults', async () => {
   for (const [i, type_question] of ['text', 'textarea', 'number', 'date'].entries()) {
     const r = await request(app)
       .post(url)
       .set('Authorization', `Bearer ${admin}`)
       .send({
         ...good,
         question_id: 'Q_TEXT_' + i,
         type_question,
         order: String(i + 1)
       });

     console.log('CREATE QUESTION:', type_question, r.body);
     expect(r.body.code).toBe('1001');
   }

   const r = await request(app)
     .post(url)
     .set('Authorization', `Bearer ${admin}`)
     .send({
       ...good,
       question_id: 'Q_RADIO',
       type_question: 'radio',
       options: [
         { option_text: 'Yes', option_value: 'yes', order: '1' },
         { option_text: 'No', option_value: 'no', order: '2' }
       ],
       placeholder: 'Choose',
       is_required: '1',
       help_text: 'Help',
       allow_image: '1',
       show_if_answer: '{}',
       trigger_image_upload: '1'
     });

   console.log('CREATE RADIO RESPONSE:', r.body);
   expect(r.body.code).toBe('1001');
   expect(r.body.data.options).toHaveLength(2);

   const child = await request(app)
     .post(url)
     .set('Authorization', `Bearer ${admin}`)
     .send({
       ...good,
       question_id: 'Q_CHILD',
       parent_question_id: 'Q_RADIO'
     });

   expect(child.body.code).toBe('1001');
 });
test('W5-SQC-06: question appears in template detail', async () => {
  const created = await request(app)
    .post(url)
    .set('Authorization', `Bearer ${admin}`)
    .send(good);

  expect(created.body.code).toBe('1001');

  const r = await request(app)
    .get('/api/templates/TMPL_TEST')
    .set('Authorization', `Bearer ${admin}`);

  expect(r.body.data.sections[0].questions[0].question_id)
    .toBe(good.question_id);
});
 test.each([
  [{question_text:'x'},'2001'],[{question_id:'Q_1',type_question:'text',order:'1'},'2001'],[{},'2001'],
  [{...good,question_id:123},'2002'],[{...good,question_text:123},'2002'],[{...good,type_question:1},'2002'],[{...good,order:1},'2002'],
  [{...good,question_id:'q_itch'},'2003'],[{...good,question_id:'Q ITCH'},'2003'],[{...good,question_id:'1Q'},'2003'],
  [{...good,question_text:'   '},'2003'],[{...good,question_text:'x'.repeat(501)},'2003'],[{...good,question_text:'<b>'},'2003'],
  [{...good,type_question:'dropdown'},'2003'],[{...good,type_question:'TEXT'},'2003'],[{...good,order:'abc'},'2003'],
  [{...good,is_required:'2'},'2003'],[{...good,show_if_answer:'not json'},'2003'],
  [{...good,type_question:'text',options:[{option_text:'Yes',option_value:'yes',order:'1'}]},'2003'],
  [{...good,type_question:'radio'},'2003'],[{...good,type_question:'radio',options:[]},'2003'],
  [{...good,type_question:'radio',options:[{option_text:'A',option_value:'same',order:'1'},{option_text:'B',option_value:'same',order:'2'}]},'2003'],
  [{...good,type_question:'radio',options:'abc'},'2002'],
  [{...good,type_question:'radio',options:[{option_text:1,option_value:'x',order:'1'}]},'2002'],
  [{...good,type_question:'radio',options:[{option_text:'A',option_value:'a'}]},'2001'],
  [{...good,type_question:'radio',options:Array.from({length:51},(_,i)=>({option_text:'O'+i,option_value:'v'+i,order:String(i)}))},'2003']
 ])('W5-SQC validation %#',async(body,code)=>{const r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(body);expect(r.body.code).toBe(code);});
 test('W5-SQC-22/23/24/25/26: section, unique id, parent, and in-use checks',async()=>{
  let r=await request(app).post('/api/templates/sections/999999999/questions').set('Authorization',`Bearer ${admin}`).send(good);expect(r.body.code).toBe('3403');
  app.db.questions.push({question_id:'Q_ITCH',section_id:1,type_question:'text'});
  r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(good);expect(r.body.code).toBe('3405');
  r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send({...good,question_id:'Q_CHILD',parent_question_id:'Q_NOT_EXIST'});expect(r.body.code).toBe('3404');
  app.db.templates.push({code_template:'TMPL_OTHER',name:'Other',sections:[]});app.db.sections.push({section_id:2,template_id:'TMPL_OTHER',title:'Other',order:'1'});
  app.db.questions.push({question_id:'Q_OTHER',section_id:2,type_question:'text'});
  r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send({...good,question_id:'Q_CHILD',parent_question_id:'Q_OTHER'});expect(r.body.code).toBe('2003');
  app.db.medical_records.push({code_template:'TMPL_TEST'});
  r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send({...good,question_id:'Q_LOCK'});expect(r.body.code).toBe('3407');
 });
 test('W5-SQC-28/29/30/31/32/33/34: auth and permission',async()=>{let r=await request(app).post(url).set('Authorization',`Bearer ${admin}`).send(good);expect(r.body.code).toBe('1001');r=await request(app).post(url).send(good);expect(r.body.code).toBe('3003');r=await request(app).post(url).set('Authorization','Bearer abc').send(good);expect(r.body.code).toBe('3001');r=await request(app).post(url).set('Authorization','Bearer expired_token_mock').send(good);expect(r.body.code).toBe('3002');app.db.blacklist.add('token_1');r=await request(app).post(url).set('Authorization','Bearer token_1').send(good);expect(r.body.code).toBe('3001');r=await request(app).post(url).set('Authorization',`Bearer ${patient}`).send(good);expect(r.body.code).toBe('3102');r=await request(app).post(url).set('Authorization',`Bearer ${doctor}`).send(good);expect(r.body.code).toBe('3102');});
});

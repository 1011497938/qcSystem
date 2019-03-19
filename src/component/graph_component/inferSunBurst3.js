import dataStore, { personManager, triggerManager, filtEvents, eventManager, eucDist, hasSimElmIn, addrManager, timeManager, arrayAdd, simplStr, objectManager, dictCopy, sortBySimilar, ruleFilterWith, normalizeVec, ruleFilter, meanVec } from '../../dataManager/dataStore2'
import React, { Component } from 'react'
import * as d3 from 'd3'
import net_work from '../../dataManager/netWork'
import { Button, Card, Image, Container, Divider, Checkbox, Dropdown, DimmerInner, Menu} from 'semantic-ui-react'
import tsnejs from '../../dataManager/tsne'

import {
    XYPlot,
    XAxis,
    YAxis,
    Hint,
    AreaSeries,
    LineMarkSeries,
    MarkSeries,
    LineSeries,
    Highlight,
    LabelSeries
  } from 'react-vis';

import stateManager from '../../dataManager/stateManager'
import { autorun, values } from 'mobx';
import cos_dist from 'compute-cosine-distance'
import { link } from 'fs';
import hint from 'react-vis/dist/plot/hint';

const PI = Math.PI
const inner_radius = 0.4 //圆的内轮廓

// 更换的时候this值也应该换！
class InferSunBurst extends React.Component{
    all_events = []
    center_event = undefined

    all_addrs = []
    all_triggers = []
    all_people = []
    all_years = []


    now_click_value = undefined
    former_click_value = undefined

    stateStack = []  //回到上一步用的


    constructor(){
        super()
        this.state = {
            label_data: [],
            event_label_data: [],
            center_event_label_data: [],


            mouseover_value: undefined,
            mouseover_filter_values: undefined,
            // mouseover_rule: undefined,

            isDrag: false,
            isMousePressed: false,

            drag_value: undefined,
            filter_values: [],
            mouse_postion: undefined,

            rules: []
        }
    }


    onFilterChange = autorun(()=>{
        if (stateManager.is_ready) {
            const need_refresh = stateManager.need_refresh
            this.loadData()
        }
    })

    loadNewEvent = autorun(()=>{
        // console.log(stateManager.selected_event)
        if (stateManager.is_ready) {
            let selected_event_id = stateManager.selected_event_id.get()
            // let selected_event = eventManager.get(selected_event_id)
            net_work.require('getAllRelatedEvents', {event_id:selected_event_id, event_num:8000})
            .then(data=>{
                console.log(data)
                data = dataStore.processResults(data.data)
                let {events} = data
                // console.log(events.length)
                let center_event = eventManager.get(selected_event_id)
                // console.log(center_event)
                this.all_events = dataStore.dict2array(events)
                if (!this.all_events.includes(center_event)) {
                    this.all_events.push(center_event)
                }
                this.center_event = center_event
                this.loadData()
            })
        }
    })

    loadData(){
        let {all_events, center_event} = this
        if (!center_event) {
            console.warn('center_event 不存在')
            return
        }
        let {prob_year, prob_addr, prob_person} = center_event
        const center_people = center_event.getPeople()

        // 被添加到rule里的objects
        let filter_objects = []
        this.state.rules.forEach(elm=>{
            filter_objects = [...elm.getAllObjects()]
        })
        // all_events = ruleFilter(all_events)
        // all_events = ruleFilterWith(all_events, ['y','t','a', 'p'])

        let all_triggers = [...new Set(ruleFilterWith(all_events, ['y','p','a']).map(event=> event.trigger))]
        // console.log(all_triggers)
        let trigger2sim = {}
        all_triggers.forEach(trigger=>{
            if (trigger.vec.length !== center_event.trigger.vec.length)
                return
            trigger2sim[trigger.id] = cos_dist(trigger.vec, center_event.trigger.vec)
        })
        all_triggers = all_triggers.sort((a,b)=> trigger2sim[a.id]-trigger2sim[b.id]).slice(0, 45)
        all_triggers = all_triggers.sort((a,b)=> a.name-b.name)

        let all_people = []
        ruleFilterWith(all_events, ['y','t','a']).forEach(event=>{
            let people = event.getPeople()
            all_people = [...all_people, ...people]
        })
        all_people = [...new Set(all_people)]
        let people2sim = {}
        all_people.forEach(person=>{
            const center_people = center_event.getPeople()
            people2sim[person.id] = center_people.reduce((total, center_person)=>{
                // console.log(total + cos_dist(person.vec, center_person.vec), total, center_people.length)
                return total + cos_dist(person.vec, center_person.vec)
            }, 0)/center_people.length
        })

        // let test_trigger = triggerManager.getByName('弹劾')[0]
        // let test = sortBySimilar(all_people, [center_event], [], 100)
        // console.log(test, test_trigger)

        // person_11645
        // console.log(people2sim['person_11645'], people2sim['person_3767'])

        all_people = all_people.sort((a,b)=> people2sim[a.id]-people2sim[b.id]).slice(0, 45)

        let all_addrs = []
        ruleFilterWith(all_events, ['y','t','p']).forEach(event=>{
            let addr = event.addrs
            all_addrs = [...all_addrs, ...addr]
        })
        all_addrs = [...new Set(all_addrs)]
        let addr2sim = {}
        all_addrs.forEach(addr=>{
            if (center_event.addrs.length!==0) {
                const center_addrs = center_event.addrs
                addr2sim[addr.id] = center_addrs.reduce((total, center_addr)=>{
                    return total + cos_dist(addr.vec, center_addr.vec)
                }, 0)/center_addrs.length
            }else{
                addr2sim[addr.id] = cos_dist(addr.vec, center_event.vec)
            }
        })
        all_addrs = all_addrs.sort((a,b)=> addr2sim[a.id]-addr2sim[b.id]).slice(0,45)

        let all_years = new Set()
        all_events.forEach(event=>{
            all_years.add(event.time_range[0])
            all_years.add(event.time_range[1])
        })
        all_years = [...all_years].map(year=> timeManager.get(year))
        // Object.keys(prob_year)
        // console.log(all_years, timeManager.id_set)
        all_years = all_years.sort((a,b)=> parseFloat(prob_year[b])-parseFloat(prob_year[a])).slice(0,45)

        const center_x = 0, center_y = 0

        const myTsne = (vecs, dim=1)=>{
            const opt = {
                epsilon: 10,  // epsilon is learning rate (10 = default)
                perplexity: 10, // roughly how many neighbors each point influences (30 = default)
                dim: dim // dimensionality of the embedding (2 = default)
            }
            let tsne = new tsnejs.tSNE(opt); // create a tSNE instance
            if (vecs.length===0) {
                return []
            }
            tsne.initDataRaw(vecs);  //这里用dist会出问题
            for(var k = 0; k < 0; k++) {
                tsne.step();
            }

            return  tsne.getSolution();
        }

        const objects2Vec = (all_objects, start_angle, end_angle, center_index = undefined, center_vec = undefined, object_type, color) =>{
            start_angle += PI/360
            end_angle -= PI/360

            let vecs = all_objects.map(elm=> elm.toVec())
            if (center_vec) {
                vecs.push(center_vec)
                center_index = vecs.length-1
            }

    
            let angles = myTsne(vecs).map(elm=> elm[0])
            let min_angle = Math.min(...angles),
                max_angle = Math.max(...angles)

            // console.log(max_angle, min_angle, angles)
            angles = angles.map(elm=> (elm-min_angle)/(max_angle-min_angle))

            // console.log(new_vecs, vecs)
            // let center_index = all_objects.findIndex(elm=> elm===center_event.trigger)

            // let center_angle = angles[center_index]

            let dists = vecs.map(elm=> cos_dist(elm, vecs[center_index]) )
            // let max_dist = Math.max(...dists.filter((elm,index)=> index!==center_index)),
            //     min_dist = Math.min(...dists.filter((elm,index)=> index!==center_index))
            // dists = dists.map(elm => (elm-min_dist)/(max_dist-min_dist))
            let sort_dists = [...dists].sort((a,b)=> a-b)
            dists = dists.map(dist=> sort_dists.findIndex(elm=> elm===dist)/dists.length)

            angles[center_index] = Math.random()*(max_angle-min_angle)+min_angle
            let sort_angles = [...angles].sort((a,b)=> a-b)
            // console.log(angles, sort_angles)
            angles = angles.map(angle=> sort_angles.findIndex(elm=> elm===angle)/angles.length)
            // console.log(angles)
            let label_data = all_objects.map((elm, index)=>{
                // 直径应该更加均匀
                let radius = dists[index] * (1-inner_radius) + inner_radius
                let angle = angles[index]*(end_angle-start_angle) + start_angle
                let x = center_x + radius*Math.cos(angle), y = radius*Math.sin(angle) + center_y
                let text_rotate = -angle/PI*180
                if (text_rotate<-90&& text_rotate>-270) {
                    text_rotate = 180+text_rotate
                }
                return {
                    x: x,
                    y: y,
                    origin_x: x,
                    origin_y: y,
                    rotation: text_rotate,
                    label: simplStr(elm.getName(), 4),
                    object_id: elm.id,
                    vec: vecs[index],
                    new_vec: angles[index],
                    object_type: object_type,
                    label_type: 'related_object',
                    links: [],
                    style: {
                        stroke: color,
                        cursor: "pointer",
                        fontSize: 12,
                        opacity: 0.5,
                    },
                }
            })
            return label_data
        }

        const total_angle = 2*PI
        let stack_angle = 0
        let trigger_num = all_triggers.length, addr_num = all_addrs.length,  people_num = all_people.length, year_num = all_years.length
        let angle_per_object = total_angle/(trigger_num+addr_num+people_num+year_num)
        
        console.log(center_people)
        let center_people_vec = meanVec(center_people)

        let center_addr_vec = center_event.vec
        if (center_event.addrs.length>0) {
            center_addr_vec = meanVec(center_event.addrs)
        }

        // let center_time_vec = center_event.vec
        // let

        let trigger_label_data = objects2Vec(all_triggers, stack_angle, stack_angle += trigger_num*angle_per_object, undefined, center_event.trigger.vec, 'trigger', '#f4cea3')
        let people_label_data = objects2Vec(all_people, stack_angle, stack_angle += people_num*angle_per_object, undefined, center_people_vec, 'people', '#9a8bb9')
        let addr_label_data = objects2Vec(all_addrs, stack_angle, stack_angle += addr_num*angle_per_object, undefined, center_addr_vec, 'addr', '#bfdda8')
        let year_label_data = objects2Vec(all_years, stack_angle, stack_angle += year_num*angle_per_object, undefined, center_event.toVec(), 'year', '#e29cae')
        
        let label_data = [...trigger_label_data, ...people_label_data, ...addr_label_data, ...year_label_data]
        let id2label = {}
        label_data.forEach(elm=>{
            id2label[elm.object_id] = elm
        })

        this.all_triggers = all_triggers
        this.all_people = all_people
        this.all_triggers = all_triggers
        this.all_years = all_years
        this.all_events = all_events

        let center_event_label_data = [{
            x: center_x, y: center_y, label: center_event.toText()
        }]
        
        let left_events = []   //跟剩下的有关的事件
        let event2links = {}
        all_events.forEach(event=>{
            let links = []   //记录了事件连接的点
            if (all_triggers.includes(event.trigger)) {
                links.push(id2label[event.trigger.id])
            }
            event.getPeople().forEach(person=>{
                if (all_people.includes(person)) {
                    links.push(id2label[person.id])
                }
            })
            event.addrs.forEach(addr=>{
                if (all_addrs.includes(addr)) {
                    links.push(id2label[addr.id])
                }
            })
            if(event.isTimeCertain()){
                let year = event.time_range[0]
                year = timeManager.get(year)
                if (all_years.includes(year)) {
                    links.push(id2label[year.id])
                }
            }
            if (links.length>1) {
                left_events.push(event)
                event2links[event.id] = links.filter(link=> link)
            }
        })

        let event_label_data = []
        // let vecs = left_events.map(elm => elm.vec)
        // let new_vecs = myTsne(vecs, 2)
        // new_vecs = normalizeVec(new_vecs)
        // console.log(new_vecs)

        event_label_data = left_events.map((event, index)=>{
            const links = event2links[event.id]
            let x = links.reduce((total,elm)=> total+elm.x, 0)/links.length
            let y = links.reduce((total,elm)=> total+elm.y, 0)/links.length
            let dist = eucDist([x,y], [center_x, center_y])
            if (dist> inner_radius*inner_radius) {
                x = x*inner_radius/dist * (1-Math.random()/3)
                y = y*inner_radius/dist * (1-Math.random()/3)
            }
            if (event===center_event) {
                x = 0
                y = 0
            }
            return {
                x: x,
                y: y,
                label: event.toText(),
                object_id: event.id,
                opacity: 0.5,
                links: links,
                style: {
                    // stroke: color,
                    cursor: "pointer",
                    fontSize: 20,
                    opacity: 0.5,
                },
            }
        })


        event_label_data.forEach((elm,index)=>{
            const {links} = elm
            links.forEach(object=>{
                object.links.push(index)
            })
        })

        // console.log(left_events)

        this.setState({
            label_data: label_data,
            center_event_label_data: center_event_label_data,
            event_label_data: event_label_data,
        })
    }

    static get defaultProps() {
        return {
          width: 800,
          height: 600,
        };
    }

    value_equal(value1, value2){
        return value1.x===value2.x && value1.y===value2.y 
    }

    links_datas = []
    show_event_label_data = []
    all_objects = []  //存放显示出来的所有object
    
    render(){
        console.log('render triggerSunBurst')
        const {width, height} = this.props
        const {center_event, value_equal} = this
        
        let {center_event_label_data, label_data, mouseover_value, event_label_data, rules} = this.state
        let {isDrag, mouse_postion, isMousePressed, drag_value, filter_values} = this.state
        let {all_addrs,all_triggers,all_people, all_years} = this
        // console.log(all_years)
        label_data = label_data.map(elm=>{
            if (mouseover_value && elm.x===mouseover_value.x && elm.y===mouseover_value.y) {
                elm.style.opacity = 1
            }else{
                elm.style.opacity = 0.5
            }
            return elm
        })

        let links_datas = []
        let show_event_label_data = []
        if (mouseover_value && mouseover_value.links) {
            let links = mouseover_value.links.map(index => event_label_data[index]).filter(elm=>elm)
            links.forEach(event_label=>{
                show_event_label_data.push(event_label)
                let elms =  event_label.links
                elms.forEach(elm=>{
                    let {x,y} = elm
                    if (elm.x!==mouseover_value.x && elm.y!==mouseover_value.y) {
                        elm.style.opacity = 1
                        let x_string = x.toString()
                        let random1 = parseFloat(x_string.slice(x_string.length-2,x_string.length-1)),
                            random2 = parseFloat(x_string.slice(x_string.length-2,x_string.length-1))

                        random1 = isNaN(random1)?0.2:random1/20
                        random2 = isNaN(random2)?0.001:random1/100*eucDist([x,y], [event_label.x,event_label.y])
                        let center_x = (event_label.x*random1 + x*(1-random1))/2
                        let center_y = (event_label.y*random1 + y*(1-random1))/2
                        links_datas.push([
                            {x:x, y:y},
                            {x: center_x , y: center_y+random2},
                            {x:event_label.x, y:event_label.y}
                        ])                         
                    }
                })
            })
            this.links_datas = links_datas
            this.show_event_label_data = show_event_label_data
        }else{
            links_datas = this.links_datas
            show_event_label_data = this.show_event_label_data
        }
        // console.log(links_datas)

        const xDomain = [-1.5,3], yDomain = [-1.5,1.5]
        const graph_width = width<height?width: height
        const graph_height = graph_width/1.5
        const trueX2X =  d3.scaleLinear().domain([0, graph_width]).range(xDomain),
            trueY2Y =  d3.scaleLinear().domain([0, graph_height]).range([yDomain[1], yDomain[0]])

        this.all_objects = [...label_data, ...rules, ...filter_values]
        this.all_objects.forEach((elm,index)=>{
            elm._index = index
        })
        console.log(this.state.rules)
        return (
            <div 
                className='trigger_sunburst_graph' 
                style={{width: width, height: height, position: 'absolute', 
                // background:'#fffaaa'
                }}>
                <XYPlot 
                width={graph_width} 
                height={graph_height}
                xDomain={xDomain}
                yDomain={yDomain}
                onMouseDown = {event=>{
                    console.log('MouseDown', mouseover_value)
                    if (this.now_click_value===mouseover_value) {
                        return
                    }
                    this.former_click_value = this.now_click_value
                    this.now_click_value = mouseover_value    
                    let {former_click_value, now_click_value} = this

                    if (mouseover_value) {
                        // if (mouseover_value.label_type==='related_object') {
                        //     drag_value = dictCopy(mouseover_value)

                        // }else{
                        //     drag_value = mouseover_value
                        // }
                        drag_value = mouseover_value
                        drag_value.origin_x = drag_value.x
                        drag_value.origin_y = drag_value.y
                        if (now_click_value.label_type==='filter_object') {
                            if (former_click_value) {
                                if (former_click_value.label_type==='filter_object') {
                                    let {rules} = this.state
                                    let new_rule = new Rule()
                                    new_rule.addObject(now_click_value)
                                    new_rule.addObject(former_click_value)
                                    rules.push(new_rule)
                                    this.setState({rules: rules})
                                    stateManager.setRules(rules)
                                    this.former_click_value = undefined
                                    this.now_click_value = undefined
                                }
                                // console.log(former_click_value, now_click_value)
                                if (former_click_value.label_type==='rule' && now_click_value.label_type==='filter_object') {
                                    let rule = former_click_value
                                    rule.addObject(now_click_value)
                                    stateManager.setRules(rules)
                                    this.setState({rules: rules})
                                }
                            }
                        }
                        if (now_click_value && former_click_value) {
                            if (former_click_value.label_type==='filter_object' && now_click_value.label_type==='rule') {
                                // console.log('link')
                                let rule = now_click_value
                                rule.addObject(former_click_value)
                                this.setState({rules: rules})
                            }
                        }
                    }
                    // console.log(drag_value)
                    this.setState({isMousePressed: true, isDrag: true, drag_value: drag_value})
                }}
                onMouseUp = {event=>{
                    console.log('MouseUP', this.state.mouseover_value)
                    // let {mouseover_value} = this.state
                    // && drag_value.label_type!=='filter_object' && drag_value.label_type!=='rule'
                    if (drag_value && drag_value.x>1.1) {
                        if (true || filter_values.findIndex(elm=> elm.object_id===drag_value.object_id)===-1) { //改成了可以添加多个相同节点 
                            // 还需要重新布局优化
                            if (drag_value.label_type==='related_object') {
                                drag_value = dictCopy(drag_value)
                                drag_value.rotation = 0
                                
                                drag_value.label_type = 'filter_object'
                                filter_values.push(drag_value)
                                if (drag_value.object_type==='people') {
                                    stateManager.addSelectedPeople(drag_value.object_id)
                                }
                                let new_rule = new Rule()
                                new_rule.addObject(drag_value)
                                let {rules} = this.state
                                rules.push(new_rule)
                                stateManager.setRules(rules)
                                this.setState({rules: rules})                                
                            }
                        }
                        this.former_click_value = undefined
                        this.now_click_value = undefined
                    }
                    this.setState({
                        isMousePressed: false, 
                        isDrag: false, 
                        drag_value: undefined, 
                        filter_values: filter_values,
                        mouseover_value: undefined
                    })
                }}
                >
                    {/* 用来控制拖动 */}
                    <LabelSeries
                    labelAnchorX = 'middle'
                    labelAnchorY = 'middle'
                    style={{
                        pointerEvents: isDrag ? 'none' : '',
                        lineerEvents: isDrag ? 'none' : ''
                    }}
                    onNearestXY={(value, {event})=>{
                        let {layerX, layerY, movementX, movementY} = event
                        let {isDrag} = this.state
                        let graph_x = trueX2X(layerX), graph_y = trueY2Y(layerY)
                        if (drag_value) {
                            drag_value.x = graph_x
                            drag_value.y = graph_y
                        }
                        if (isDrag) {
                            this.setState({mouse_postion: [graph_x, graph_y], drag_value: drag_value})
                        }
                        // console.log(layerX, layerY, movementX, movementY, trueX2X(layerX), trueY2Y(layerY))
                    }}
                    data={center_event_label_data}
                    allowOffsetToBeReversed
                    animation/>


                    {/* 连接规则和筛选的实体之间的线 */}
                    {
                        rules.filter(elm=> elm.related_values.length>0).map(elm=> elm.getSelf()).map((elm, elm_index)=>{
                            // console.log(elm)
                            let {x,y, related_values} = elm
                            return related_values.map((value,index)=>{
                                return (<LineSeries
                                key={elm_index+'-'+index}   //key可以更加的优化
                                data={[value, elm]}
                                color='#1234'
                                />)
                            })

                        })
                    }

                    {/* 显示规则的点 */}
                    <MarkSeries
                    data={rules.filter(elm=>elm.related_values.length>1)}
                    onValueMouseOver={value=>{
                        value = this.all_objects[value._index]
                        if (!mouseover_value || (!value_equal(value, mouseover_value) && !isDrag && !isMousePressed)) {
                            this.setState({mouseover_value: value})
                        }
                    }}/>

                    {/* {
                        drag_value &&
                        <LabelSeries
                        labelAnchorX = 'end'
                        labelAnchorY = 'end'
                        animation
                        data={[drag_value]}
                        color='literal'/>
                    } */}


                    {/* 拖出来的实体 */}
                    <LabelSeries
                    labelAnchorX = 'middle'
                    labelAnchorY = 'middle'
                    animation
                    data={filter_values}
                    onValueMouseOver={value=>{
                        value = this.all_objects[value._index]
                        if (!mouseover_value || (!value_equal(value, mouseover_value) && !isDrag && !isMousePressed)) {
                            this.setState({mouseover_value: value})
                        }
                    }}
                    onValueMouseOut={value=>{
                        this.setState({mouseover_value: undefined})
                    }}
                    color='literal'
                    allowOffsetToBeReversed/>

                    {/* 中间那个代表事件的点点 */}
                    <MarkSeries
                    data={show_event_label_data}
                    style={{
                        pointerEvents: isDrag ? 'none' : '',
                        lineerEvents: isDrag ? 'none' : ''
                    }}
                    onValueClick={value=>{
                        console.log(value)
                    }}/>
                    {
                    links_datas.map((elm,index)=>
                        <LineSeries
                        key={index}
                        color='#1234'
                        data={elm}
                        style={{
                            pointerEvents: isDrag ? 'none' : '',
                            lineerEvents: isDrag ? 'none' : ''
                        }}
                        curve={d3.curveCatmullRom.alpha(0.1)}/>
                    )
                    }

                    <LabelSeries
                    labelAnchorX = 'end'
                    labelAnchorY = 'end'
                    animation
                    data={label_data}
                    color='literal'
                    allowOffsetToBeReversed
                    onValueMouseOver={value=>{
                        value = this.all_objects[value._index]
                        console.log(value, value._index)
                        if (!mouseover_value || (!value_equal(value, mouseover_value) && !isDrag && !isMousePressed)) {
                            this.setState({mouseover_value: value})
                        }
                    }}
                    onValueMouseOut={value=>{
                        this.setState({mouseover_value: undefined})
                        // console.log('clear')
                    }}
                    style={{
                        pointerEvents: isDrag ? 'none' : '',
                        lineerEvents: isDrag ? 'none' : ''
                    }}/>

                    {
                        // mouseover_value&&
                        // <Hint value={mouseover_value}>
                        //     <div style={{ fontSize: 8,background: 'black', padding: '10px'}}>
                        //     {objectManager.get(mouseover_value.object_id).getName()}
                        //     </div>
                        // </Hint>
                    }
                    <XAxis/>
                    <YAxis/>
                </XYPlot>
            </div>
        )
    }
}

// 生成一个树状结构
class RuleManager{
    constructor(){
        this.rules = []
    }
    create(){
        let new_rule = new Rule()
        this.rules.push(new_rule)
        return new_rule
    }
}
const ruleManager = new RuleManager()

class Node{
    constructor(){
        this.sub_node = []
        this.sub_objects = []
    }
}

class Rule{
    related_values = []
    x = 0
    y = 0
    object_type = 'rule'
    label_type = 'rule'
    getAllObjects(){
        return this.related_values.map(elm=> objectManager.get(elm.object_id))
    }
    getSelf(){
        let {related_values} = this
        this.x = related_values.reduce((total, elm)=>  total+elm.x, 0)/related_values.length + 0.1
        this.y = related_values.reduce((total, elm)=>  total+elm.y, 0)/related_values.length + 0.1
        return this
    }
    addObject(value){
        let {related_values} = this
        related_values.push(value)
        this.x = related_values.reduce((total, elm)=>  total+elm.x, 0)/related_values.length + 0.1
        this.y = related_values.reduce((total, elm)=>  total+elm.y, 0)/related_values.length + 0.1
    }
}

export default InferSunBurst
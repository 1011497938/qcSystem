import React from 'react';
import * as d3 from 'd3';
import mo from '../../static/mo.png';

// 3/16 直接画短线段

function throttle(fn, delay) {
  var timer;
  return function () {
    var _this = this;
    var args = arguments;
    if (timer) {
      return;
    }
    timer = setTimeout(function () {
      fn.apply(_this, args);
      timer = null; 
    }, delay)
  }
}

export default class AreaLineChart extends React.Component {
  constructor() {
    super();
    this.area = d3.area()
      .curve(d3.curveMonotoneX)
    this.eventArray = [];
    this.calculateX2 = this.calculateX2.bind(this);
    this.imp_scale = d3.scaleLinear()
      .domain([0, 0.001, 0.01, 0.1, 1])
      .range([0.4, 0.5, 0.6, 0.9, 1]);
    this.angle_scale = d3.scaleLinear()
      .domain([-10, 0, 10])
      .range([90, 0, -90]);

    // for the image showing when circle hovering
    this.state= {
      moBound: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }
    }
  }

  componentDidMount() {
    this.calculatePos(this.props.data);
    this.handleHoverEvents()
  }

  componentWillReceiveProps(nextProps) {
    this.calculatePos(nextProps.data);
    this.handleHoverEvents()
  }

  setImgBound = (x,y,size) =>{
    this.setState({
      moBound: {
        x: x-size/2,
        y: y-size/2,
        width: size,
        height: size
      }
    })
  }

  getD(node) {
    const $this = d3.select(node);
    const { eventArray } = this;

    let indexOut = $this.attr('indexout');
    let indexIn = $this.attr('indexin');

    return eventArray[(+indexOut) + 1][+indexIn];
  }

  handleHoverEvents() {
    let { onMouseOver, onMouseOut, onMouseClick, width, height, xscale, yscale } = this.props;
    const node = this.refs.area;

    const that = this;

    const $g = d3.select(node)
      .select('.certainEventPoint');

    $g.selectAll('circle')
      .on('mouseover', function() {
        let pos = d3.mouse(node);

        throttle(() => {
          let x = pos[0] + 10;
          if (pos[0] + 10 + 160 > width) x = pos[0] - 180;
          let y = pos[1] - 100;
          y = y - 10 < 0 ? 10 : y;
          y = y + 160 > height ? y - 20 : y;

          let d = that.getD(this)

          onMouseOver(d.event, [x, y]);

          that.setImgBound(xscale(d.x), yscale(d.y), d.len*30);

          // console.log('mouseover');
        }, 300)()

      })
      .on('mouseout', () => {
        throttle(() => {
          onMouseOut();
          that.setImgBound(0,0,0);
          // console.log('mouseout');

        }, 300)()
      })
      .on('mousedown', function () {

        let pos = d3.mouse(node);
        throttle(() => {
          let x = pos[0] + 10;
          if (pos[0] + 10 + 160 > width) x = pos[0] - 180;
          let y = pos[1] - 100;
          y = y - 10 < 0 ? 10 : y;
          y = y + 160 > height ? y - 20 : y;

          const d = that.getD(this);
          
          onMouseClick(d.event, [x, y]);

          that.setImgBound(xscale(d.x), yscale(d.y), d.len*30);
        },300)()

      });
  }

  calculatePos(data) {
    let { selected_person } = this.props;
    if (data.length !== 0 && data[0].length !== 0) {
      let eventArray = [];
      data.forEach((dd, index) => {
        let eventCircles = [];
        let lene = 0;
        dd.forEach((d, i) => {
          let y0 = d.y0;
          let y = d.y;
          let x = d.x;
          let len = d.events.length;
          lene += len;
          for (let j = 0; j < len; j++) {
            let event = d.events[j];
            let score = event.getScore(selected_person);
            let imp = event.getImp(selected_person);
            let tmp = {};
            tmp.y = y0 + (y - y0) * this.imp_scale(imp);
            if (tmp.y < 0.2) tmp.y = 0.2;
            tmp.x = x - 0.5 + j / len;
            tmp.k = this.angle_scale(score);
            tmp.len = this.imp_scale(imp);
            tmp.event = event;
            tmp.id = event.id;
            eventCircles.push(tmp);
          }
        })
        eventArray.push(eventCircles);
      })
      this.eventArray = eventArray;
    }
  }

  // 未使用
  renderCircles() {
    let { yscale, xscale, onMouseOver, onMouseOut, onMouseClick, width, height, viewType } = this.props;
    const node = this.refs.area;
    // console.log(this.eventArray)
    // d3.select(this.refs.area)
    //   .selectAll('circle').remove();
    let dom;
    if (this.eventArray.length > 0) {
      let eventArray;
      // if(!viewType){
      //   eventArray = [this.eventArray[0]];
      //   d3.select(this.refs.area)
      //     .select('.certainEventPoint')
      //     .selectAll('image').attr('visibility','visible');
      //   d3.select(this.refs.area)
      //     .select('.certainEventPoint')
      //     .selectAll('image:not(.circle0)').attr('visibility','hidden');
      // }else{
      eventArray = this.eventArray.slice(1);
      //   d3.select(this.refs.area)
      //     .select('.certainEventPoint')
      //     .selectAll('image').attr('visibility','visible');
      //   d3.select(this.refs.area)
      //     .select('.certainEventPoint')
      //     .selectAll('.circle0').attr('visibility','hidden');
      // }
      eventArray.forEach((events, index) => {
        // if(!viewType){
        dom = d3.select(this.refs.area)
          .select('.certainEventPoint')
          .selectAll(`.circle${index}`)
          .data(events, (d) => d.id)
        dom.attr('x', (d, i) => {
          return xscale(d.x);
        })
          .attr('y', (d, i) => {
            return yscale(d.y);
          })
          .attr('transform', (d) => `rotate(${d.k},${xscale(d.x)},${yscale(d.y)})`)
        dom.exit().remove();
        dom.enter()
          .append("svg:image")
          .attr('class', (d) => {
            if (d.event.is_change) {
              return `circle${index} circleimg change`
            } else {
              return `circle${index} circleimg`
            }
          })
          .attr('x', (d, i) => {
            return xscale(d.x);
          })
          .attr('y', (d, i) => {
            return yscale(d.y);
          })
          .attr('width', (d) => d.len * 20)
          .attr('height', (d) => d.len * 20)
          .attr("xlink:href", mo)
          .attr('opacity', 0.1)
          .attr('transform', (d) => `rotate(${d.k},${xscale(d.x)},${yscale(d.y)})`)
          .on('mouseover', function (d) {
            let pos = d3.mouse(node);
            let x = pos[0] + 10;
            if (pos[0] + 10 + 160 > width) x = pos[0] - 180;
            let y = pos[1] - 100;
            y = y - 10 < 0 ? 10 : y;
            y = y + 160 > height ? y - 20 : y;
            onMouseOver(d.event, [x, y]);
            d3.select(this).attr('opacity', 1.0)
              .attr('width', (d) => d.len * 30)
              .attr('height', (d) => d.len * 30);
          })
          .on('mouseout', function (d) {
            onMouseOut();
            d3.select(this).attr('opacity', 0.1)
              .attr('width', (d) => d.len * 20)
              .attr('height', (d) => d.len * 20)
          })
          .on('mousedown', function (d) {
            let pos = d3.mouse(node);
            let x = pos[0] + 10;
            if (pos[0] + 10 + 160 > width) x = pos[0] - 180;
            let y = pos[1] - 100;
            y = y - 10 < 0 ? 10 : y;
            y = y + 160 > height ? y - 20 : y;
            onMouseClick(d.event, [x, y]);
          });
        // dom.enter()
        //   .append('circle')
        //   .attr('class',()=>{
        //     if(!viewType){
        //       return `circle${index}`
        //     }else{
        //       return `circle${index+1}`
        //     }
        //   })
        //   .attr('cx',(d,i)=>{
        //     return xscale(d.x);
        //   })
        //   .attr('cy',(d,i)=>{
        //     return yscale(d.y);
        //   })
        //   .attr('r',(d,i)=>{
        //     return d.len*8;
        //   })
        //   .attr('fill','rgb(200,200,200)')
        //   .attr('fill-opacity',(d)=>d.len)
        // .on('mouseover',(d)=>{
        //   let pos = d3.mouse(this.refs.area);
        //   let x= pos[0]+10;
        //   if(pos[0]+10+160>width) x = pos[0]-180;
        //   let y = pos[1]-100;
        //   y= y-10<0? 10: y;
        //   y = y+160>height? y-20: y;
        //   onMouseOver(d.event,[x,y]);
        // })
        // .on('mouseout',(d)=>{
        //   onMouseOut();
        // })
        // .on('mousedown',(d)=>{
        //   let pos = d3.mouse(this.refs.area);
        //   let x= pos[0]+10;
        //   if(pos[0]+10+160>width) x = pos[0]-180;
        //   let y = pos[1]-100;
        //   onMouseClick(d.event,[x,y]);
        // });
      })
    }
  }

  // 未使用
  hoverEventPoints(name) {
    let { yscale, xscale } = this.props;
    d3.select(this.refs.area)
      .select('.certainEventPoint')
      .selectAll('image')
      // .style('mix-blend-mode','soft-light')
      .attr('opacity', 0.1)
      .attr('width', (d) => d.len * 20)
      .attr('height', (d) => d.len * 20)
    let dom = d3.select(this.refs.area)
      .select('.certainEventPoint')
      .selectAll('image')
      .filter((d, i) => {
        return d.event.trigger.getName() === name
      })
    dom
      // .style('mix-blend-mode','hard-light')
      .attr('opacity', 1.0)
      .attr('width', (d) => d.len * 30)
      .attr('height', (d) => d.len * 30)
  }

  // 未使用
  renderCanvas() {
    let { yscale, xscale, width, height, viewType, index } = this.props;
    let canvas = d3.select(this.refs.area).select(`#canvas${index}`).node();
    canvas.width = width;
    canvas.height = (height + 30);
    canvas.style.width = width + 'px';
    canvas.style.height = (height + 30) + 'px';

    let context = canvas.getContext("2d");
    let cx, cy, x2, y2, tmp_len, tmp_k;
    context.clearRect(0, 0, width, (height + 30));
    context.strokeStyle = 'rgba(100,100,100,1.0)';
    context.lineWidth = 1;
    // context.filter = 'blur(4px)';
    let eventArray;
    if (!viewType) {
      eventArray = [this.eventArray[0]];
    } else {
      eventArray = this.eventArray.slice(1);
    }
    this.eventArray.forEach((events, index) => {
      if (!viewType) {
        context.fillStyle = "rgba(120,120,120,0.7)";
        context.strokeStyle = "rgba(120,120,120,0.7)";
      } else {
        context.fillStyle = this.fillStyle[index];
        context.strokeStyle = this.fillStyle[index];
      }
      events.forEach((d, i) => {
        context.beginPath();
        cx = xscale(d.x);
        cy = (yscale(d.y) + 30); //30是设定的上方宽度
        context.moveTo(cx, cy);
        context.arc(cx, cy, d.len * 20, 0, 2 * Math.PI);
        context.fill();
        context.closePath();
        context.beginPath();
        context.moveTo(cx, cy);
        x2 = this.calculateX2(d.len * 40, d.k, cx);
        y2 = -d.k * (x2 - cx) + cy;
        context.lineTo(x2, y2);
        cx += 1;
        cy += 1;
        context.moveTo(cx, cy);
        tmp_len = d.len * 0.6;
        tmp_k = d.k * 0.8;
        x2 = this.calculateX2(tmp_len * 40, tmp_k, cx);
        y2 = -tmp_k * (x2 - cx) + cy;
        context.lineTo(x2, y2)
        context.stroke();
        cx -= 2;
        cy -= 2;
        context.moveTo(cx, cy);
        tmp_len = d.len * 0.6;
        tmp_k = d.k * 1.5;
        x2 = this.calculateX2(tmp_len * 40, tmp_k, cx);
        y2 = -tmp_k * (x2 - cx) + cy;
        context.lineTo(x2, y2)
        context.stroke();
        context.closePath();
      })
    })
    context.fill();
  }

  calculateX2(len, k, x1) {
    let diff = len / Math.sqrt(k * k + 1);
    return x1 + diff;
  }

  render() {
    let { data, xscale, yscale, translate, viewType, selectTrigger, imgBound } = this.props;

    let { eventArray } = this;
    const { moBound } = this.state;

    if (viewType) {
      data = data.slice(1);
    }
    else {
      data = data[0];
    }

    // console.log('selectTrigger', selectTrigger)
    // this.hoverEventPoints(selectTrigger);

    this.area.x((d) => xscale(d.x))
      .y1((d) => yscale(d.y))
      .y0((d) => yscale(d.y0));

    eventArray && (eventArray = eventArray.slice(1))

    return (
      <g className="area" ref="area" translate={translate}>
        {viewType ? data && data.map((d, i) => <path key={i} d={this.area(d)} fill={`url(#linear${i})`} />) : data && <path d={this.area(data)} fill={'url(#linear)'}></path>}
        <g className="certainEventPoint">
          <image href={mo} {...moBound} 
            style={{ pointerEvents: 'none', cursor: 'pointer', transition: 'width 300ms ease-in-out', userSelect: 'none',}}
          ></image>

          <g className='circles'>
            {
              eventArray && eventArray.length > 0 && eventArray.map((events, index) => {
                return events.map((d, i) => {
                  // 替代之前的hoverEventPoints函数的功能
                  if(d.event.trigger.getName() === selectTrigger || !selectTrigger) {
                    return (<circle 
                      key={index+''+i} 
                      className={['circle' + index, d.event.is_change ? `circle${index} circleimg change`:`circle${index} circleimg`].join(' ')} 
                      cx={xscale(d.x)}
                      cy={yscale(d.y)}
                      r={d.len * 10}
                      opacity={0.1}
                      indexout={index}
                      indexin={i}
                      transform={`rotate(${d.k},${xscale(d.x)},${yscale(d.y)})`}
                      style={{cursor: 'pointer'}}
                    />)
                  } else {
                    return null;
                  }
                })
              })
            }
          </g>
        </g>
      </g>
    );
  }
}
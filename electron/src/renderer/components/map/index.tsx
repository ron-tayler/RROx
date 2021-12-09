import React, { createRef, useMemo, useEffect, useState } from 'react';
import Background from "../../../../assets/images/bg.jpg";
import TransparentBackground from "../../../../assets/images/transparentBg.png";
import { Button, Tooltip } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, AimOutlined, StopOutlined } from '@ant-design/icons';
import { MapData, MapProperties } from './interfaces';
import { Frame } from './Frame';
import { IsTrack, Spline } from './Spline';
import { Switch } from './Switch';
import { Turntable } from './Turntable';
import { Player } from './Player';
import SVGPanZoom from 'svg-pan-zoom';
import { WaterTower } from './WaterTower';
import { FirewoodDepot } from './FirewoodDepot';
import { MapContext } from './context';

// @ts-expect-error
import SVGUtils from 'svg-pan-zoom/src/svg-utilities';

export function Map( { data }: { data: MapData } ) {

    const svgRef = createRef<SVGSVGElement>();
    const [ panZoom, setPanZoom ] = useState<SvgPanZoom.Instance | null>( null );
    const [ following, setFollowing ] = useState<{ type: 'player' | 'frame', index: number, element?: SVGElement, data?: any } | null>( null );

    const [ mode, setMode ] = useState<'normal' | 'map' | 'minimap'>( window.mode === 'overlay' ? 'minimap' : 'normal' );
    const [ transparent, setTransparent ] = useState( window.mode === 'overlay' ? window.settingsStore.get( 'minimap.transparent' ) as boolean : false );


    useEffect(() => {
        let onMouseWheel: ( event: WheelEvent ) => void;

        let panZoom = SVGPanZoom( svgRef.current, {
            zoomEnabled: true,
            controlIconsEnabled: false,
            mouseWheelZoomEnabled: false,
            fit: true,
            center: true,
            viewportSelector: '.map_viewport',
            maxZoom: 100,
            customEventsHandler: {
                haltEventListeners: [],
                init: ( options ) => {
                    let lastMouseWheelEventTime = Date.now();

                    onMouseWheel = ( event: WheelEvent ) => {
                        if ( !options.instance.isZoomEnabled() )
                            return;

                        event.preventDefault();
            
                        // Default delta in case that deltaY is not available
                        let delta = event.deltaY || 1,
                            timeDelta = Date.now() - lastMouseWheelEventTime,
                            divider = 3 + Math.max( 0, 30 - timeDelta );
            
                        // Update cache
                        lastMouseWheelEventTime = Date.now();

                        delta =
                            -0.3 < delta && delta < 0.3
                                ? delta
                                : ( ( delta > 0 ? 1 : -1 ) * Math.log( Math.abs( delta ) + 10 ) ) / divider;
            
                        let inversedScreenCTM = options.svgElement.getScreenCTM().inverse(),
                            relativeMousePoint = SVGUtils.getEventPoint( event, options.svgElement ).matrixTransform(
                                inversedScreenCTM
                            ),
                            zoom = Math.pow( 1.1, -1 * delta ); // multiplying by neg. 1 so as to make zoom in/out behavior match Google maps behavior

                        if( options.instance.isPanEnabled() )
                            options.instance.zoomAtPointBy( zoom, relativeMousePoint );
                        else
                            options.instance.zoomBy( zoom );
                    };
                    options.svgElement.addEventListener( 'wheel', onMouseWheel );
                },
                destroy: ( options: SvgPanZoom.CustomEventOptions ) => {
                    options.svgElement.removeEventListener( 'wheel', onMouseWheel );
                },
            }
        } );

        setPanZoom( panZoom );

        if( window.mode === 'overlay' ) {
            setFollowing( { type: 'player', index: 0, element: null, data: null } );
            panZoom.zoom( 20 );
        }

        return () => {
            panZoom.destroy();
        };
    }, [ svgRef.current ] );

    useEffect( () => {
        const cleanup = window.ipc.on( 'set-mode', ( event, mode, transparent ) => {
            setMode( mode );
            setTransparent( transparent );
        } );

        return () => {
            cleanup();
        }
    }, [] );

    const map: MapProperties = useMemo( () => {
        const imageWidth = 8000;
        const minX = -200000;
        const maxX = 200000;
        const minY = -200000;
        const maxY = 200000;
        const x = maxX - minX;
        const y = maxY - minY;
        const scale = ( imageWidth * 100 / Math.max( x, y ) );
        const imx = x / 100 * scale;
        const imy = y / 100 * scale;

        return {
            imageWidth,
            minX,
            maxX,
            minY,
            maxY,
            x,
            y,
            scale,
            imx,
            imy
        }
    }, [] );

    useEffect( () => {
        if( !panZoom || !svgRef.current || !following || !following.element || mode === 'map' )
            return;

        const svg = svgRef.current;

        const pan = () => {
            let svgBB     = svg.getBoundingClientRect();
            let elementBB = following.element.getBoundingClientRect();

            let top  = elementBB.top + elementBB.height / 2 - svgBB.top;
            let left = elementBB.left + elementBB.width / 2 - svgBB.left;

            panZoom.resize();
            panZoom.panBy( { x: svgBB.width / 2 - left, y: svgBB.height / 2 - top } );
        };

        window.addEventListener( 'resize', pan );

        panZoom.disablePan();

        pan();

        return () => {
            window.removeEventListener( 'resize', pan );

            panZoom.enablePan();
        }
    }, [ panZoom, svgRef.current, following?.element, following?.data, mode ] );

    return <MapContext.Provider
        value={{
            followElement: ( type, index, element, data ) => setFollowing( { type, index, element, data } ),
            stopFollowing: () => setFollowing( null ),
            following,
            minimap: mode === 'minimap',
        }}
    >
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: window.mode === 'overlay' ? undefined : '#fefef2' }}>
            <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8000 8000" style={{ width: '100%', height: '100%' }}>
                <defs>
                    <pattern id="bg" x="0" y="0" width="8000" height="8000" patternUnits="userSpaceOnUse">
                        <image x="0" y="0" width="8000" height="8000" href={Background} />
                    </pattern>
                    <pattern id="transparentBg" x="0" y="0" width="8000" height="8000" patternUnits="userSpaceOnUse">
                        <image x="0" y="0" width="8000" height="8000" href={TransparentBackground} />
                    </pattern>
                </defs>
                <g className={'map_viewport'}>
                    <rect x="0" y="0" width="8000" height="8000" fill={ transparent ? 'url(#transparentBg)' : 'url(#bg)'} stroke="black" className={'map_image'} />
                    {data.Splines.filter( ( { Type } ) => !IsTrack( Type ) ).map( ( d, i ) => <Spline key={i} data={d} map={map} index={i}/> )}
                    {data.Splines.filter( ( { Type } ) =>  IsTrack( Type ) ).map( ( d, i ) => <Spline key={i} data={d} map={map} index={i}/> )}
                    {data.Turntables.map( ( d, i ) => <Turntable key={i} data={d} map={map} index={i}/> )}
                    {data.Switches.map( ( d, i ) => <Switch key={i} data={d} map={map} index={i}/> )}
                    {data.Industries.filter( ( d ) => d.Type === 10 ).map( ( d, i ) => <FirewoodDepot key={i} data={d} map={map} index={i}/> )}
                    {data.WaterTowers.map( ( d, i ) => <WaterTower key={i} data={d} map={map} index={i}/> )}
                    {data.Frames.map( ( d, i ) => <Frame key={i} data={d} map={map} index={i}/> )}
                    {data.Players.map( ( d, i ) => <Player key={i} data={d} map={map} index={i}/> )}
                </g>
            </svg>
            {mode !== 'minimap' && <div style={{ position: 'absolute', right: 0, top: 0 }}>
                <Tooltip title='Zoom In' placement='left'>
                    <Button type="primary" shape="circle" icon={<ZoomInOutlined  />} style={{ margin: '30px 30px 20px 0', display: 'block' }} onClick={() => panZoom?.zoomBy( 1.3 )}/>
                </Tooltip>
                <Tooltip title='Zoom Out' placement='left'>
                    <Button type="primary" shape="circle" icon={<ZoomOutOutlined />} style={{ margin: '20px 30px 20px 0', display: 'block' }} onClick={() => panZoom?.zoomBy( 1 / 1.3 )}/>
                </Tooltip>
                {data.Players.length > 0 &&<Tooltip title={following ? 'Stop Following' : 'Follow Player'} placement='left'>
                    <Button type="primary" shape="circle" icon={following ? <StopOutlined /> : <AimOutlined />} style={{ margin: '20px 30px 0 0', display: 'block' }} onClick={() => {
                        if( following )
                            setFollowing( null );
                        else
                            setFollowing( { type: 'player', index: 0, element: null, data: null } );
                    }}/>
                </Tooltip>}
            </div>}
        </div>
    </MapContext.Provider>;
}
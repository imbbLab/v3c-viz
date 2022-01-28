
import * as React from 'react'

interface MenuProps {
    onColourButtonClicked: () => void
    onTriangleButtonClicked: () => void
}

interface MenuState {
    menuToShow: MenuToShow
}


enum MenuToShow {
    None,
    LoadTrack,
    SaveImage,

}

export class Menu extends React.Component<MenuProps, MenuState> {

    loadTrackButton: HTMLSpanElement | undefined
    saveImageButton: HTMLSpanElement | undefined

    constructor(props: MenuProps) {
        super(props);

        this.state = {
            menuToShow: MenuToShow.None
        }
    }

    styleForMenu(button: HTMLSpanElement): React.CSSProperties {
        let buttonPosition = button.getBoundingClientRect();

        return {
            display: 'block',
            top: buttonPosition.top + "px",
            position: 'fixed'
        }
    }

    render(): React.ReactNode {
        return (
            <div>
                <div id="menubar-div" className="sidenav">
                    <span ref={(loadTrackButton: HTMLSpanElement) => this.loadTrackButton = loadTrackButton} className="menubtn icon-load-track" title="Load a track" id="loadTrack"
                        onMouseOver={() => {
                            this.setState({ menuToShow: MenuToShow.LoadTrack })
                        }}></span>

                    <span ref={(saveImageButton: HTMLSpanElement) => this.saveImageButton = saveImageButton} className="menubtn icon-save-image" title="Save view to image" id="saveButton"
                        onMouseOver={() => {
                            this.setState({ menuToShow: MenuToShow.SaveImage })
                        }}></span>

                    <span className="menubtn icon-triangle-view" title="Swap to triangle view" id="viewChangeButton"
                        onClick={this.props.onTriangleButtonClicked}
                        onMouseOver={() => {
                            this.setState({ menuToShow: MenuToShow.None })
                        }}></span>

                    <span className="menubtn icon-hide-image" title="Hide image view" id="hideButton"
                        onMouseOver={() => {
                            this.setState({ menuToShow: MenuToShow.None })
                        }}></span>

                    <span className="menubtn icon-show-colourmap" title="Edit colourmaps for data views" id="editColourmapButton"
                        onClick={this.props.onColourButtonClicked}
                        onMouseOver={() => {
                            this.setState({ menuToShow: MenuToShow.None })
                        }}></span>
                </div>
                {this.state.menuToShow == MenuToShow.LoadTrack &&
                    <div id="loadTrackMenu" style={this.styleForMenu(this.loadTrackButton!)} className="menu-dropdown"
                        onMouseLeave={() => {
                            this.setState({ menuToShow: MenuToShow.None })
                        }}>
                        <input type="file" id="file-selector" accept=".bed, .bw"></input>
                    </div>
                }
                {this.state.menuToShow == MenuToShow.SaveImage &&
                    <div id="saveImageMenu" style={this.styleForMenu(this.saveImageButton!)} className="menu-dropdown">
                        <button className="dropbtn " id="saveSVGButton">SVG</button>
                        <button className="dropbtn " id="savePNGButton" style={{ display: "none" }}>PNG</button>
                    </div>
                }
            </div >
        )
    }
}
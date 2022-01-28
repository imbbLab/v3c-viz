
import * as React from 'react'

interface MenuProps {
    onColourButtonClicked: () => void
    onHideImageButtonClicked: () => void
    onTriangleButtonClicked: () => void

    loadUploadedTrack: (uploadedTrack: UploadedTrack) => void
}

interface MenuState {
    menuToShow: MenuToShow
}


enum MenuToShow {
    None,
    LoadTrack,
    SaveImage,

}


export interface UploadedTrack {
    filename: string
    location: string
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
                        onClick={this.props.onHideImageButtonClicked}
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
                        <input type="file" id="file-selector" accept=".bed, .bw" onChange={(event: React.ChangeEvent<HTMLInputElement>) => {

                            if (event.target.files) {
                                let data = new FormData();
                                data.append('myFile', event.target.files[0]);

                                let filename = event.target.files[0].name;

                                // send fetch along with cookies
                                fetch('/upload', {
                                    method: 'POST',
                                    credentials: 'same-origin',
                                    body: data
                                }).then((response) => {
                                    if (response.status !== 200) {
                                        console.log('Looks like there was a problem. Status Code: ' +
                                            response.status);
                                        return;
                                    }

                                    response.text().then((location: string) => {
                                        var tracksString = window.sessionStorage.getItem("loadedTracks");
                                        var tracks: UploadedTrack[]

                                        if (!tracksString) {
                                            tracks = []
                                        } else {
                                            tracks = JSON.parse(tracksString);
                                        }

                                        let newTrack: UploadedTrack = { filename: filename, location: location };
                                        tracks.push(newTrack);
                                        window.sessionStorage.setItem("loadedTracks", JSON.stringify(tracks));

                                        this.props.loadUploadedTrack(newTrack);
                                    });
                                });


                                /*const reader = new FileReader();
                                
                                } else if (extension?.localeCompare("bw") == 0) {
                                    type = 'wig'
                                    format = 'bigwig';
                         
                                    // Need to copy the file to the server and then load a link
                                }
                         
                         
                                reader.readAsDataURL(fileSelector.files[0])*/
                            }
                        }}></input>
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
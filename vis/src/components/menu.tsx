
import * as React from 'react'

interface MenuProps {
}

interface MenuState {
}

export class Menu extends React.Component<MenuProps, MenuState> {

    render(): React.ReactNode {
        return (
            <div id="menubar-div" className="sidenav">
                <span className="menubtn icon-load-track" title="Load a track" id="loadTrack"></span>
                <span className="menubtn icon-save-image" title="Save view to image" id="saveButton"></span>
                <span className="menubtn icon-triangle-view" title="Swap to triangle view" id="viewChangeButton"></span>
                <span className="menubtn icon-hide-image" title="Hide image view" id="hideButton"></span>
                <span className="menubtn icon-show-colourmap" title="Edit colourmaps for data views" id="editColourmapButton"></span>
            </div>
        )
    }
}
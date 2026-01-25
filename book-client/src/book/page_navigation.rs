//! Page navigation system
//!
//! Connects BookState (logical pages) to PageCurlState (animation)

use bevy::prelude::*;
use super::{BookState, PageCurlState, TurnPhase};

/// Resource tracking the last known page index (to detect changes)
#[derive(Resource, Default)]
struct LastPageIndex {
    index: Option<usize>,
}

/// System that triggers page curl animations when BookState changes
pub fn trigger_page_turn_on_navigation(
    book_state: Res<BookState>,
    mut curl_state: ResMut<PageCurlState>,
    mut last_index: Local<Option<usize>>,
) {
    let current_index = book_state.current_index();

    // Initialize on first run
    if last_index.is_none() {
        *last_index = Some(current_index);
        return;
    }

    // Check if page changed
    if Some(current_index) != *last_index {
        // Page changed - trigger curl animation
        if curl_state.phase == TurnPhase::Idle {
            curl_state.target_curl = 1.0;
            curl_state.phase = TurnPhase::Turning;

            info!("Page navigation detected: {} -> {}, triggering curl",
                  last_index.unwrap(), current_index);
        } else {
            warn!("Page change requested but curl already in progress");
        }

        *last_index = Some(current_index);
    }
}

import React from 'react';
import {isToday, isYesterday} from 'date-fns';
import {
  faBell as faSolidBell,
  faChevronDown,
  faChevronRight,
  faEdit,
  faEye,
  faHistory,
  faLink,
  faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import {faUserTie} from '@fortawesome/free-solid-svg-icons';
import {faBell as faRegularBell} from '@fortawesome/free-regular-svg-icons';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import {formatDate} from '../../utils/calendar';

const TeamRow = ({
                   team,
                   depth = 0,
                   hasChildren = false,
                   memberCount,
                   daysHeader,
                   isCollapsed,
                   isFocused,
                   isSubscribed,
                   isDropTarget,
                   leaderName,
                   onToggleCollapse,
                   onFocusTeam,
                   onAddMember,
                   onOpenSubscriptionMenu,
                   onOpenHistory,
                   onEditTeam,
                   onCopyCalendarLink,
                   onDeleteTeam,
                   onDragOver,
                   onDragLeave,
                   onDrop,
                 }) => {
  const collapseTarget = hasChildren ? 'team and sub-teams' : 'team';
  const collapseIconTitle = isCollapsed ? `Expand ${collapseTarget}` : `Collapse ${collapseTarget}`;
  const focusIconTitle = isFocused ? 'Show all teams' : 'Focus on team';
  // An ancestor the active filter pruned, kept only so the nesting still reads
  // correctly. It is context, not a result: no members, no actions, no drops.
  const isStructural = Boolean(team.isStructuralPlaceholder);
  // Everyone at or below this team. A team that only groups sub-teams would
  // otherwise read as (0) while its branch is full of people. Falls back to the
  // team's own roster so the row still renders standalone, without the count the
  // calendar rolls up for it.
  const shownCount = memberCount ?? team.team_members.length;

  return (
    <tr
      className={`team-row ${isStructural ? 'team-row--structural' : ''} ${isDropTarget ? 'drop-target' : ''}`}
      data-depth={depth}
      style={{'--team-depth': depth}}
      onDragOver={isStructural ? undefined : (e) => onDragOver(e, team._id)}
      onDragLeave={isStructural ? undefined : (e) => onDragLeave(e)}
      onDrop={isStructural ? undefined : (e) => onDrop(e, team._id)}
    >
      <td className="team-name-cell">
        <FontAwesomeIconWithTitle
          icon={isCollapsed ? faChevronRight : faChevronDown}
          title={collapseIconTitle}
          wrapperClassName="collapse-icon"
          wrapperProps={{
            onClick: () => onToggleCollapse(team._id),
            role: 'button',
          }}
        />
        {isStructural ? (
          <span className="team-name-block">
            <span className="team-name-text" title={team.name}>{team.name}</span>
          </span>
        ) : (
          <>
            <FontAwesomeIconWithTitle
              icon={faEye}
              title={focusIconTitle}
              wrapperClassName={`eye-icon ${isFocused ? 'eye-icon-active' : ''}`}
              wrapperProps={{
                onClick: () => onFocusTeam(team._id),
                role: 'button',
              }}
            />
            <span className="team-name-block">
              <span className="team-name-text" title={team.name}>{team.name}</span>
              {/* Spelled out for a parent: the number counts the sub-teams too, and a
                  collapsed row gives no other clue where its people are. */}
              <span
                className="team-member-count"
                title={hasChildren
                  ? `${shownCount} ${shownCount === 1 ? 'person' : 'people'} in this team and its sub-teams`
                  : undefined}
              >({shownCount})</span>
              {/* The same icon marks the leader's own row, so no "Leader:" prefix is
                  needed — and the name column has no room to spare for one. */}
              {leaderName && (
                <span className="team-leader" title={`Team leader: ${leaderName}`}>
                  {/* Titleless, so the wrapper span owns the tooltip for icon and name together. */}
                  <FontAwesomeIconWithTitle icon={faUserTie} aria-hidden="true"/>
                  {/* First name only: the action icons reserve their width even while
                      hidden, and a full name here costs the team name characters.
                      The tooltip carries it in full. */}
                  <span className="team-leader-name">{leaderName.split(' ')[0]}</span>
                </span>
              )}
            </span>
            {/* The bell comes first: an active subscription keeps it visible while the
                other icons hide, so it belongs next to the name rather than adrift
                behind the hidden plus. */}
            <FontAwesomeIconWithTitle
              icon={isSubscribed ? faSolidBell : faRegularBell}
              title="Manage team subscription"
              wrapperClassName={`watch-icon ${isSubscribed ? 'watch-icon-active' : ''}`}
              wrapperProps={{
                onClick: (event) => onOpenSubscriptionMenu(event, team._id),
                role: 'button',
              }}
            />
            <span className="add-icon" onClick={() => onAddMember(team._id)}
                  title="Add team member">➕</span>
            <FontAwesomeIconWithTitle
              icon={faHistory}
              title="View team history"
              wrapperClassName="history-icon"
              wrapperProps={{
                onClick: () => onOpenHistory(team),
                role: 'button',
              }}
            />
            <FontAwesomeIconWithTitle
              icon={faEdit}
              title="Edit team"
              wrapperClassName="edit-icon"
              wrapperProps={{
                onClick: () => onEditTeam(team._id),
                role: 'button',
              }}
            />
            <FontAwesomeIconWithTitle
              icon={faLink}
              title="Copy calendar feed link"
              wrapperClassName="calendar-link-icon"
              wrapperProps={{
                onClick: () => onCopyCalendarLink(team._id),
                role: 'button',
              }}
            />
            {/* Direct members, deliberately not the rolled-up count above: the backend
                reparents the sub-teams and then hard-deletes only when the team's own
                roster is empty, so a staffed branch below must not hide this. */}
            {team.team_members.length === 0 && (
              <FontAwesomeIconWithTitle
                icon={faTrashAlt}
                title="Delete team"
                wrapperClassName="delete-icon"
                wrapperProps={{
                  onClick: () => onDeleteTeam(team._id),
                  role: 'button',
                }}
              />
            )}
          </>
        )}
      </td>
      {daysHeader.map(({date}) => (
        <td
          key={`${team._id}-${formatDate(date)}`}
          className={`${isToday(date) ? 'current-day' : (isYesterday(date) ? 'yesterday' : '')}`}
        >
        </td>
      ))}
    </tr>
  );
};

export default TeamRow;

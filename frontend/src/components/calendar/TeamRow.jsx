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
import {faBell as faRegularBell} from '@fortawesome/free-regular-svg-icons';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import {formatDate} from '../../utils/calendar';

const TeamRow = ({
                   team,
                   depth = 0,
                   hasChildren = false,
                   daysHeader,
                   isCollapsed,
                   isFocused,
                   isSubscribed,
                   isDropTarget,
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
              <span className="team-member-count">({team.team_members.length})</span>
            </span>
            <span className="add-icon" onClick={() => onAddMember(team._id)}
                  title="Add team member">➕</span>
            <FontAwesomeIconWithTitle
              icon={isSubscribed ? faSolidBell : faRegularBell}
              title="Manage team subscription"
              wrapperClassName={`watch-icon ${isSubscribed ? 'watch-icon-active' : ''}`}
              wrapperProps={{
                onClick: (event) => onOpenSubscriptionMenu(event, team._id),
                role: 'button',
              }}
            />
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

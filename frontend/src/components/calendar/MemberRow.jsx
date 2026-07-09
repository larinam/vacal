import React from 'react';
import {faEdit, faGripVertical, faInfoCircle, faHistory, faTrashAlt} from '@fortawesome/free-solid-svg-icons';
import FontAwesomeIconWithTitle from '../FontAwesomeIconWithTitle';
import MemberDayCell from './MemberDayCell';
import {buildVacationTooltip, formatDate} from '../../utils/calendar';

const MemberRow = ({
                     team,
                     member,
                     daysHeader,
                     holidayData,
                     selectedCells,
                     isDragging,
                     canManageMembers,
                     displayYear,
                     onOpenHistory,
                     onDragStart,
                     onDragEnd,
                     onEditMember,
                     onDeleteMember,
                     onDayMouseDown,
                     onDayMouseOver,
                     onDayMouseUp,
                     onDayClick,
                   }) => (
  <tr className={isDragging ? 'dragging' : ''}>
    <td className="member-name-cell">
      <span className="member-name-text" title={member.name}>
        {member.name}
      </span>
      <span className="member-flag" title={member.country}>{member.country_flag}</span>
      <FontAwesomeIconWithTitle
        icon={faInfoCircle}
        title={buildVacationTooltip(member, displayYear)}
        wrapperClassName="info-icon"
      />
      <FontAwesomeIconWithTitle
        icon={faHistory}
        title="View history"
        wrapperClassName="history-icon"
        wrapperProps={{
          onClick: () => onOpenHistory(team._id, member),
          role: 'button',
        }}
      />
      <FontAwesomeIconWithTitle
        icon={faGripVertical}
        title="Move to another team"
        wrapperClassName="drag-icon"
        wrapperProps={{
          draggable: true,
          onDragStart: (e) => onDragStart(e, team._id, member.uid, member.name),
          onDragEnd: onDragEnd,
        }}
      />
      <FontAwesomeIconWithTitle
        icon={faEdit}
        title="Edit member"
        wrapperClassName="edit-icon"
        wrapperProps={{
          onClick: () => onEditMember(team._id, member.uid),
          role: 'button',
        }}
      />
      {canManageMembers && (
        <FontAwesomeIconWithTitle
          icon={faTrashAlt}
          title="Delete member"
          wrapperClassName="delete-icon"
          wrapperProps={{
            onClick: () => onDeleteMember(team._id, member.uid),
            role: 'button',
          }}
        />
      )}
    </td>
    {daysHeader.map(({date}) => (
      <MemberDayCell
        key={`${member.uid}-${formatDate(date)}`}
        teamId={team._id}
        member={member}
        date={date}
        holidayData={holidayData}
        isSelected={selectedCells.some((cell) => cell.date.getTime() === date.getTime() && cell.memberId === member.uid)}
        onMouseDown={onDayMouseDown}
        onMouseOver={onDayMouseOver}
        onMouseUp={onDayMouseUp}
        onClick={onDayClick}
      />
    ))}
  </tr>
);

export default MemberRow;

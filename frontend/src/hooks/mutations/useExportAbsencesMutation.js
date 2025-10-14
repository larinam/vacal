import {useMutation} from '@tanstack/react-query';

const buildExportUrl = (startDate, endDate, teamIds = []) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });

  teamIds.forEach((id) => {
    if (id) {
      params.append('team_ids', id);
    }
  });

  return `/teams/export-absences?${params.toString()}`;
};

export const useExportAbsencesMutation = (apiCall) => {
  return useMutation({
    mutationFn: ({startDate, endDate, teamIds}) => {
      const url = buildExportUrl(startDate, endDate, teamIds);
      return apiCall(url, 'GET', null, true);
    },
  });
};

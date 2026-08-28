import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApplicationStatus } from '../coiffeur-applications.service';

export class ListCoiffeurApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'validated', 'rejected'])
  status?: ApplicationStatus;
}

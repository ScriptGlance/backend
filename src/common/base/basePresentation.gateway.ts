import {PresentationEntity} from "../entities/PresentationEntity";
import {BaseGateway} from "./base.gateway";
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import {Repository} from "typeorm";

export abstract class BasePresentationGateway extends BaseGateway {

    protected constructor(
        jwtService: JwtService,
        configService: ConfigService,
        protected readonly presentationRepository: Repository<PresentationEntity>,
    ) {
        super(jwtService, configService)
    }


    protected async getPresentationWithAccessControl(
        presentationId: number,
        userId: number,
    ) {
        const presentation = await this.presentationRepository
            .createQueryBuilder('presentation')
            .leftJoinAndSelect('presentation.owner', 'owner')
            .leftJoinAndSelect('owner.user', 'ownerUser')
            .leftJoinAndSelect('presentation.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .where('presentation.presentationId = :id', { id: presentationId })
            .getOne();

        return presentation &&
        this.userHasAccessToPresentation(presentation, userId)
            ? presentation
            : null;
    }

    protected userHasAccessToPresentation(
        presentation: PresentationEntity,
        userId: number,
    ): boolean {
        if (presentation.owner?.user?.userId === userId) {
            return true;
        }

        return presentation.participants?.some(
            (participant) => participant.user?.userId === userId,
        );
    }
}
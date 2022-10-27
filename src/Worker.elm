port module Worker exposing (..)

import Dict exposing (Dict)
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode
import Maybe exposing (withDefault)
import Shared exposing (todoDecoder, todoEncoder)


port inbox : (InboxMsg Params -> msg) -> Sub msg


port outbox : OutboxMsg Params -> Cmd msg


type alias Model =
    { sharedContext : ContextDict }



-- Platform


type alias Handle =
    Encode.Value


type alias Params =
    Encode.Value


type alias Content =
    Encode.Value


type alias Context =
    Encode.Value


type alias ContextDict =
    Dict String Handle


type alias OutboxMsg content =
    { content : content
    , context : Context
    }


type alias InboxMsg content =
    { content : content
    , context : Context
    }


type alias Query params =
    { entity : String
    , operation : String
    , params : Codec params
    }



-- Main


main : Program () Model Msg
main =
    Platform.worker
        { init = init
        , update = update
        , subscriptions = subscriptions
        }


init : () -> ( Model, Cmd Msg )
init _ =
    ( { sharedContext = Dict.empty }, Cmd.none )


subscriptions : Model -> Sub Msg
subscriptions _ =
    inboxSubs
        [ onServerRequest ServerRequest
        , onDatabaseInit DatabaseConnection
        , onDatabasePayload DatabasePayload
        ]


inboxSubs : List (InboxMsg Params -> Decoder Msg) -> Sub Msg
inboxSubs decoders =
    let
        mainDecoder inboxMsg =
            Decode.oneOf <|
                List.map (\decoder -> decoder inboxMsg) decoders

        toMsg inboxMsg =
            case Decode.decodeValue (mainDecoder inboxMsg) inboxMsg.content of
                Err error ->
                    FailedInboxMsg error

                Ok msg ->
                    msg
    in
    inbox toMsg


onServerRequest : (Context -> Content -> Msg) -> InboxMsg Params -> Decoder Msg
onServerRequest toMsg { content, context } =
    Decode.at [ "type" ] Decode.string
        |> Decode.andThen
            (\kind ->
                if kind == "server-request" then
                    Decode.succeed (toMsg context content)

                else
                    Decode.fail "Unable to decode a server-request"
            )


onDatabaseInit : (Context -> Content -> Msg) -> InboxMsg Params -> Decoder Msg
onDatabaseInit toMsg { content, context } =
    Decode.at [ "type" ] Decode.string
        |> Decode.andThen
            (\kind ->
                if kind == "database-init" then
                    Decode.succeed (toMsg context content)

                else
                    Decode.fail "Unable to decode a database-init"
            )


onDatabasePayload : (Context -> Content -> Msg) -> InboxMsg Params -> Decoder Msg
onDatabasePayload toMsg { context } =
    Decode.at [ "type" ] Decode.string
        |> Decode.andThen
            (\kind ->
                if kind == "database-payload" then
                    Decode.at [ "payload" ] Decode.value
                        |> Decode.map (\payload -> toMsg context payload)

                else
                    Decode.fail "Unable to decode a database-payload"
            )



-- Decoders


type alias Encoder a =
    a -> Encode.Value


type alias Codec a =
    { data : a
    , decoder : Decoder a
    , encoder : Encoder a
    }


encode : Encoder a -> a -> Encode.Value
encode encoder data =
    encoder data


decode : a -> Decoder a -> Decode.Value -> a
decode default decoder value =
    Decode.decodeValue decoder value
        |> Result.toMaybe
        |> withDefault default


outboxMsgEncoder : OutboxMsg Params -> Encode.Value
outboxMsgEncoder outboxMsg =
    Encode.object
        [ ( "context", outboxMsg.context )
        , ( "params", outboxMsg.content )
        ]


outboxMsgDecoder : Decoder (OutboxMsg Params)
outboxMsgDecoder =
    Decode.map2 OutboxMsg
        (Decode.field "context" Decode.value)
        (Decode.field "content" Decode.value)


inboxMsgEncoder : InboxMsg Params -> Encode.Value
inboxMsgEncoder inboxMsg =
    Encode.object
        [ ( "context", inboxMsg.context )
        , ( "params", inboxMsg.content )
        ]


inboxMsgDecoder : Decoder (InboxMsg Params)
inboxMsgDecoder =
    Decode.map2 InboxMsg
        (Decode.field "context" Decode.value)
        (Decode.field "content" Decode.value)


queryEncoder : Query params -> Params
queryEncoder info =
    Encode.object
        [ ( "entity", Encode.string info.entity )
        , ( "operation", Encode.string info.operation )
        , ( "params", encode info.params.encoder info.params.data )
        , ( "type", Encode.string "query" )
        ]


jsonResponseEncoder : (a -> Encode.Value) -> a -> Params
jsonResponseEncoder helperEncoder params =
    Encode.object
        [ ( "payload", helperEncoder params )
        , ( "type", Encode.string "json-response" )
        ]


htmlResponseEncoder : (a -> Encode.Value) -> a -> Params
htmlResponseEncoder helperEncoder params =
    Encode.object
        [ ( "payload", helperEncoder params )
        , ( "type", Encode.string "html-response" )
        ]



-- Taaks


query : Context -> Query a -> OutboxMsg Params
query context params =
    { content = queryEncoder params, context = context }


jsonResponse : Context -> (response -> Encode.Value) -> response -> OutboxMsg Params
jsonResponse context encoder params =
    { content = jsonResponseEncoder encoder params
    , context = context
    }


htmlResponse : Context -> (response -> Encode.Value) -> response -> OutboxMsg Params
htmlResponse context encoder params =
    { content = htmlResponseEncoder encoder params
    , context = context
    }



-- Update


type NewTodoParams
    = NewTodo { name : String }


type AllTodoParams
    = AllTodo {}


type Msg
    = ServerRequest Context Handle
    | DatabaseConnection Context Handle
    | DatabasePayload Context Handle
    | FailedInboxMsg Decode.Error


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        FailedInboxMsg decodeError ->
            Debug.log (Decode.errorToString decodeError)
                ( model, Cmd.none )

        ServerRequest requestHandle _ ->
            let
                hasDbHandle =
                    Dict.get "dbHandle" model.sharedContext
                        /= Nothing
            in
            if hasDbHandle then
                let
                    localContext =
                        model.sharedContext
                            |> Dict.insert "requestHandle" requestHandle
                            |> Encode.dict identity identity

                    paramsEncoder : Encoder NewTodoParams
                    paramsEncoder (NewTodo info) =
                        Encode.object
                            [ ( "name", Encode.string info.name ) ]

                    paramsDecoder : Decoder NewTodoParams
                    paramsDecoder =
                        let
                            toInfo name =
                                NewTodo { name = name }
                        in
                        Decode.map toInfo (Decode.field "name" Decode.string)

                    data : NewTodoParams
                    data =
                        NewTodo { name = "New Todo" }

                    paramsCodec : Codec NewTodoParams
                    paramsCodec =
                        { data = data
                        , decoder = paramsDecoder
                        , encoder = paramsEncoder
                        }

                    newParams : Query NewTodoParams
                    newParams =
                        { operation = "new"
                        , entity = "todo"
                        , params = paramsCodec
                        }

                    allTodos : AllTodoParams
                    allTodos =
                        AllTodo {}

                    allTodoDecoder : Decoder AllTodoParams
                    allTodoDecoder =
                        Decode.map AllTodo (Decode.succeed {})

                    allTodoEncoder : Encoder AllTodoParams
                    allTodoEncoder _ =
                        Encode.object []

                    allParamsCodec : Codec AllTodoParams
                    allParamsCodec =
                        { data = allTodos
                        , decoder = allTodoDecoder
                        , encoder = allTodoEncoder
                        }

                    allParams : Query AllTodoParams
                    allParams =
                        { operation = "all"
                        , entity = "todo"
                        , params = allParamsCodec
                        }
                in
                ( model, outbox <| query localContext allParams )

            else
                ( model, Cmd.none )

        DatabaseConnection dbHandle _ ->
            let
                sharedContext =
                    model.sharedContext |> Dict.insert "dbHandle" dbHandle
            in
            ( { model | sharedContext = sharedContext }, Cmd.none )

        DatabasePayload encodedContext payload ->
            let
                decodedPayload =
                    Decode.decodeValue (Decode.list todoDecoder) payload
                        |> Result.toMaybe
                        |> Maybe.withDefault []

                decodedContext =
                    Decode.decodeValue
                        (Decode.dict Decode.value)
                        encodedContext
                        |> Result.toMaybe

                mergeContext =
                    \localContext ->
                        let
                            requestHandle =
                                Dict.get "requestHandle" localContext
                        in
                        requestHandle
                            |> Maybe.map
                                (\handle ->
                                    model.sharedContext
                                        |> Dict.insert "requestHandle" handle
                                        |> Encode.dict identity identity
                                )
            in
            decodedContext
                |> Maybe.andThen mergeContext
                |> Maybe.andThen
                    (\localContext ->
                        Just
                            ( model
                            , outbox <|
                                htmlResponse localContext (Encode.list todoEncoder) decodedPayload
                            )
                    )
                |> Maybe.withDefault ( model, Cmd.none )
